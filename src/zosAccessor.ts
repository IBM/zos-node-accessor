/****************************************************************************/
/*                                                                          */
/* Copyright (c) 2017, 2021 IBM Corp.                                       */
/* All rights reserved. This program and the accompanying materials         */
/* are made available under the terms of the Eclipse Public License v1.0    */
/* which accompanies this distribution, and is available at                 */
/* http://www.eclipse.org/legal/epl-v10.html                                */
/*                                                                          */
/* Contributors:                                                            */
/*  IBM Corp. - initial API and implementation                              */
/*                                                                          */
/****************************************************************************/

import { ReadStream } from 'fs';

import Parser from 'ftp4/lib/parser';
Parser.parseListEntry = (line: string): string => {
    return line;
};

import FTP from 'ftp4';
import path from 'path';
import Q from 'q';

import {
    parseDataSets,
    parseJobLine,
    parseJobList,
    parseLoadLibPDSMembers,
    parsePDSMembers,
    parseSpoolTable,
    parseUSSDirList,
    USS_FILE_MODES_REX,
} from './parser';
import { Utils } from './utils';

import { ConnectionOption } from './interfaces/ConnectionOption';
import { DatasetEntry } from './interfaces/DatasetEntry';
import { DatasetMemberEntry } from './interfaces/DatasetMemberEntry';
import { Entry } from './interfaces/Entry';
import { Job, JobStatus } from './interfaces/Job';
import { JobIdOption, JobLogOption } from './interfaces/JobIdOption';
import { JobListOption } from './interfaces/JobListOption';
import { SpoolFile } from './interfaces/SpoolFile';
import { FileType, USSEntry } from './interfaces/USSEntry';

/**
 * Dataset allocation parameters, like
 *
 * ```
 * {
 *  LRECL: 80,
 *  RECFM: 'FB'
 * }
 * ```
 */
interface AllocateParams { [key: string]: string | number | boolean; }

// Input for uploading
type Input = NodeJS.ReadableStream |
    Buffer |
    string;

/**
 * Data transfer mode.
 */
export enum TransferMode {
    /**
     * The data is transferred in text mode, in which encoding conversion like ASCII/EBCDIC will happen.
     */
    ASCII = 'ascii',

    /**
     * The data is transferre in text mode, in which encoding conversion like ASCII/EBCDIC will happen, and
     * the EOL of each record in dataset will be removed.
     */
    ASCII_STRIP_EOL = 'ascii_strip_eol',

    /**
     * The data is transferred in binary mode, in which no encoding conversion will happen.
     */
    BINARY = 'binary',

    /**
     * The data is transferred in rdw mode, in which variable length dataset downloading is available.
     */
    ASCII_RDW = 'ascii_rdw',

    /**
     * The data is transferred in rdw mode, in which variable length dataset downloading is available.
     */
    BINARY_RDW = 'binary_rdw',
}

/**
 * Job status result.
 */
export enum JobStatusResult {
    SUCCESS = 'success',
    ACTIVE = 'active',
    FAIL = 'fail',
    WAITING = 'waiting',
    NOT_FOUND = 'not found',
}

/**
 * USS file type to operate.
 */
export enum FileToOperate {
    /**
     * Operate against one file or directory
     */
    FILE_OR_DIRECTORY,

    /**
     * Operate against the whole directory, including any file/directory under it.
     */
    WHOLE_DIRECTORY,
}

/**
 * The max buffer size for downloading.
 */
const MAX_BUFFER_SIZE = 4 * 1024 * 1024;

class ZosAccessor {

    private client: FTP;
    private connected: boolean;
    private username?: string;

    // Maximum allowed buffer size in one request.
    private maxBufferSize: number = MAX_BUFFER_SIZE;

    /**
     * Indicates zos-node-accessor in migration mode.
     */
    private migrationMode: boolean = false;

    public constructor() {
        this.client = new FTP();
        this.connected = false;
    }

    /**
     * Set the max buffer size for downloading.
     *
     * @param maxBufferSize - Max buffer size in byte
     */
    public setMaxBufferSize(maxBufferSize: number) {
        this.maxBufferSize = maxBufferSize;
    }

    /**
     * Returns the max buffer size for downloading.
     *
     * @returns Max buffer size for downloading
     */
    public getMaxBufferSize(): number {
        return this.maxBufferSize;
    }

    /**
     * Sets zos-node-accessor to migration mode, which keeps the original key/value pair field in
     * `DatasetEntry`, 'DatasetMemberEntry`, `UssEntry`, and `SpoolFile`, so that it makes the
     * migration from v1.0.x to v2.x easy.
     *
     * @param migrationMode - True to enable migration mode
     */
    public setMigrationMode(migrationMode: boolean): void {
        this.migrationMode = migrationMode;
    }

    /**
     * Returns true if it's connected to z/OS FTP service successfully.
     *
     * @returns True if it's connected to z/OS FTP service successfully.
     */
    public isConnected(): boolean {
        return this.connected;
    }

    /**
     * Connects to z/OS FTP service.
     *
     * @param option - The option for connecting z/OS FTP service
     * @returns This ZosAccessor object if success
     */
    public async connect(option: ConnectionOption): Promise<ZosAccessor> {
        const deferred = Q.defer<ZosAccessor>();
        this.username = option.user;
        this.client.on('ready', () => {
            this.connected = true;
            deferred.resolve(this);
        }).on('error', (err: Error) => {
            this.connected = false;
            deferred.reject(err);
        }).on('close', () => {
            this.connected = false;
        });

        const ftpOption: FTPConnectionOption = {
            host: option.host,
            password: option.password,
            port: option.port || 21,
            user: option.user,
            // tslint:disable-next-line: object-literal-sort-keys
            secure: option.secure || false,
            secureOptions: option.secureOptions,
            connTimeout: option.connTimeout || 30000,
            pasvTimeout: option.pasvTimeout || 30000,
            keepalive: option.keepalive || 10000,
         };

        this.client.connect(ftpOption);
        return deferred.promise;
    }

    /**
     * Closes the connection to z/OS FTP service.
     */
    public async close(): Promise<void> {
        const deferred = Q.defer<void>();
        this.client.logout((err: Error) => {
            if (err) {
                deferred.reject(err);
                return;
            }
            this.client.end();
            deferred.resolve();
        });
        return deferred.promise;
    }

    /**
     * Submits SITE commands.
     * 
     * @param siteCommands site commands separated with space
     * @returns what's returned from server
     */
    public async site(siteCommands: string): Promise<string> {
        const deferred = Q.defer<string>();
        this.client.site(siteCommands, (err: Error, text?: string) => {
            if (err) {
                deferred.reject(err);
                return;
            }
            deferred.resolve(text);
        })
        return deferred.promise;
    }

    /**
     * Submits STAT command to query server status.
     * 
     * @param option optional option. If not specified, query for all status.
     * @returns what's returned from server
     */
    public async stat(option?: string): Promise<string> {
        const command = option ? `stat (${option}` : 'stat'; 
        return this.send(command);
    }

    /**
     * Sends any command that FTP can understand with SEND.
     * 
     * @param command command to send
     * @returns what's returned from server
     */
    public async send(command: string): Promise<string> {
        const deferred = Q.defer<string>();
        this.client._send(command, (err: Error, text?: string) => {
            if (err) {
                deferred.reject(err);
                return;
            }
            deferred.resolve(text);
        })
        return deferred.promise;
    }

    /**
     * Makes USS directory with the given directory name.
     *
     * @param directoryName - Directory name
     * @returns Promise to return void
     */
    public async makeDirectory(directoryName: string): Promise<void> {
        const ftpClient = this.client;
        const deferred = Q.defer<void>();
        ftpClient.mkdir(directoryName, (err: Error) => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve();
            }
        });
        return deferred.promise;
    }

    /**
     * Allocates the sequential or partition (with the DCB attribut "PDSTYPE=PDS") dataset.
     * These attributes are transferred as FTP site sub commands. The tested attributes includes:
     *
     * ```
     * BLKsize/BLOCKSIze, BLocks, CYlinders, Directory, LRecl, PDSTYPE, PRImary, RECfm, SECondary, and TRacks
     * ```
     *
     * @param datasetName - Name of the dataset to allocate
     * @param allocateParamsOrString - String of space separated DCB attributes or the object of DCB attribute
     *            key-value pairs. eg. "LRECL=80 RECFM=FB" or {"LRECL": 80, "RECFM": "FB"}.
     * @returns Promise to return void
     */
    public async allocateDataset(datasetName: string, allocateParamsOrString?: string | AllocateParams): Promise<void> {
        const ftpClient = this.client;
        datasetName = Utils.ensureFullQualifiedDSN(datasetName);
        const datasetList = await this.listDatasets(datasetName);
        if (datasetList.length) {
            throw new Error('Dataset ' + datasetName + ' already exists');
        }

        let allocateParamString: string;
        if (typeof allocateParamsOrString === 'string') {
            allocateParamString = allocateParamsOrString as string;
        } else {
            allocateParamString = this.allocateParamsToString(allocateParamsOrString);
        }
        if (allocateParamString.indexOf('DSORG=PO') !== -1 ||
            allocateParamString.indexOf('PDSTYPE=PDS') !== -1 ||
            allocateParamString.indexOf('PDSTYPE=PDSE') !== -1) {
            // Remove DSORG since it's not valid site sub command.
            allocateParamString = allocateParamString.replace('DSORG=PO', '');
            // Allocate an PDS dataSet
            const deferred = Q.defer<void>();
            ftpClient.site(allocateParamString, (err: Error) => {
                if (err) {
                    return deferred.reject(err);
                }
                ftpClient.mkdir(datasetName, (err2: Error) => {
                    if (err2) {
                        deferred.reject(err2);
                    } else {
                        deferred.resolve();
                    }
                });
            });
            return deferred.promise;
        }

        // Allocate a seq dataSet
        // Upload a space here, because an empty Buffer may cause the "connection reset" error.
        return this.uploadDataset(Buffer.from(' '), datasetName, undefined, allocateParamString);
    }

    private async upload( input: Input, destDataset: string, transferMode: TransferMode = TransferMode.ASCII,
                          allocateParamsOrString?: string | AllocateParams): Promise<void> {
        const deferred = Q.defer<void>();
        const ftpClient = this.client;

        // We still need this check in case the other TransferMode will be added in future.
        if (transferMode !== TransferMode.ASCII &&
            transferMode !== TransferMode.BINARY) {
            throw new Error('Unsupported data type: ' + transferMode);
        }

        let allocateParamString;
        if (typeof allocateParamsOrString === 'string') {
            allocateParamString = allocateParamsOrString as string;
        } else {
            allocateParamString = this.allocateParamsToString(allocateParamsOrString);
        }

        const siteParams = ['FILETYPE=SEQ'];
        siteParams.push(allocateParamString);

        // ftpClient.ascii() or ftpClient.binary()
        ftpClient[transferMode]((err: Error) => {
            if (err) {
                return deferred.reject(err);
            }
            ftpClient.site(siteParams.join(' '), (err1: Error) => {
                if (err1) {
                    return deferred.reject(err);
                }
                destDataset = Utils.ensureFullQualifiedDSN(destDataset);
                ftpClient.put(input, destDataset, (err2: Error) => {
                    if (err2) {
                        deferred.reject(err2);
                    } else {
                        deferred.resolve();
                    }
                });
            });
        });
        return deferred.promise;
    }

    /**
     * Uploads data to the specified dataset on z/OS. The tested attributes for `allocateParamsOrString` includes:
     * These attributes are transferred as FTP site sub commands. The tested attributes includes:
     *
     * ```
     * BLKsize/BLOCKSIze, BLocks, CYlinders, Directory, LRecl, PDSTYPE, PRImary, RECfm, SECondary, and TRacks
     * ```
     *
     * @param input - Input, which can be a ReadableStream, a Buffer, or a path to a local file.
     * @param destDataset - Name of the dataset to store the uploaded data.
     * @param transferMode - Data transfer mode, either TransferMode.ASCII or TransferMode.BINARY.
     *            When transfering 'ascii' files, the end-of-line sequence of input should always be '\r\n'.
     *            Otherwise the transfered file will get truncated.
     * @param allocateParamsOrString - A string of space separated DCB attributes or an object of DCB attribute
     *          key-value pairs. eg. "LRECL=80 RECFM=FB" or {"LRECL": 80, "RECFM": "FB"}.
     */
    public async uploadDataset( input: Input, destDataset: string, transferMode: TransferMode = TransferMode.ASCII,
                                allocateParamsOrString?: string | AllocateParams): Promise<void> {
        await this.upload(input, destDataset, transferMode, allocateParamsOrString);
    }

    /**
     * Upload data to the specified USS file on z/OS.
     *
     * @param input - Input, which can be a ReadableStream, a Buffer, or a path to a local file.
     * @param destFilePath - Path name of the destination file on z/OS.
     * @param transferMode - Data transfer mode, either TransferMode.ASCII or TransferMode.BINARY
     */
    public async uploadFile(input: Input, destFilePath: string,
                            transferMode: TransferMode = TransferMode.ASCII): Promise<void> {
        await this.upload(input, destFilePath, transferMode);
    }

    private async download(dsn: string, transferMode: TransferMode = TransferMode.ASCII,
                           stream = false): Promise<Buffer | ReadStream> {
        const deferred = Q.defer<Buffer | ReadStream>();
        const ftpClient = this.client;

        // We still need this check in case the other TransferMode will be added in future.
        if (transferMode !== TransferMode.ASCII &&
            transferMode !== TransferMode.BINARY &&
            transferMode !== TransferMode.ASCII_STRIP_EOL) {
            throw new Error('Unsupported data type: ' + transferMode);
        }
        let sbsendeol = 'SBSENDEOL=CRLF';
        if (transferMode === TransferMode.ASCII_STRIP_EOL) {
            sbsendeol = 'SBSENDEOL=NONE';
            transferMode = TransferMode.ASCII;
        }

        // ftpClient.ascii() or ftpClient.binary()
        ftpClient[transferMode]((err: Error) => {
            if (err) {
                return deferred.reject(err);
            }
            ftpClient.site('FILETYPE=SEQ TRAILINGBLANKS ' + sbsendeol, (err1: Error) => {
                if (err1) {
                    return deferred.reject(err1);
                }
                dsn = Utils.ensureFullQualifiedDSN(dsn);
                ftpClient.get(dsn, (err2: Error, readStream: ReadStream) => {
                    if (err2) {
                        return deferred.reject(err2);
                    }
                    if (stream) {
                        return deferred.resolve(readStream);
                    }
                    const chunks: Buffer[] = [];
                    let bytes = 0;
                    readStream.on('data', (chunk: Buffer) => {
                        if (bytes + chunk.length >= this.maxBufferSize) {
                            const message = `Reach the maximum buffer size, ${this.maxBufferSize} bytes. ` +
                                `Change to use stream mode for big file.`;
                            deferred.reject(new Error(message));
                        }
                        chunks.push(chunk);
                        bytes += chunk.length;
                    });
                    readStream.on('end', () => {
                        deferred.resolve(Buffer.concat(chunks));
                    });
                    readStream.on('error', (err3) => {
                        deferred.reject(err3);
                    });
                    readStream.resume();
                });
            });
        });
        return deferred.promise;
    }

    /**
     * Downloads the specified dataset or member of patition dataset.
     *
     * @param dsn - Dataset name
     * @param transferMode - TransferMode.ASCII, TransferMode.BINARY, TransferMode.ASCII_RDW, TransferMode.BINARY_RDW
     *                       or TransferMode.ASCII_STRIP_EOL. When downloading a text dataset, transferMode should be
     *                       either `TransferMode.ASCII` or `TransferMode.ASCII_STRIP_EOL` so that z/OS FTP service
     *                       converts `EBCDIC` characters to `ASCII`. `TransferMode.ASCII_STRIP_EOL` asks z/OS FTP
     *                       service not to append a `CLRF` to the end of each record. `TransferMode.ASCII_RDW` and
     *                       `TransferMode.BINARY_RDW` support to download variable length dataset, which add 4-byte
     *                       Record Description Word (RDW) at the beginning of each record.
     * @param {boolean} stream - `true` if you want to obtain a `ReadStream` of the data set content, or `false`
     *                           to read a full dataset into memory (in Buffer). The buffer accepts up to 4MB data.
     *                           For large dataset, use `stream=true` instead.
     * @returns `ReadStream` or `Buffer`
     */
    public async downloadDataset(dsn: string, transferMode: TransferMode = TransferMode.ASCII,
                                 stream = false): Promise<Buffer | ReadStream> {
        if (transferMode === TransferMode.ASCII_RDW || transferMode === TransferMode.BINARY_RDW) {
            if (transferMode === TransferMode.ASCII_RDW) {
                transferMode = TransferMode.ASCII;
            } else {
                transferMode = TransferMode.BINARY;
            }
            const deferred = Q.defer<Buffer | ReadStream>();
            const ftpClient = this.client;
            ftpClient.site('rdw', async (err: Error) => {
                if (err) {
                    return deferred.reject(err);
                }
                const file = await this.download(dsn, transferMode, stream);
                deferred.resolve(file);
            });
            return deferred.promise;
        }
        return await this.download(dsn, transferMode, stream);
    }

    /**
     * Downloads the specified USS file.
     *
     * @param filePath - USS file path name
     * @param transferMode - TransferMode.ASCII, TransferMode.BINARY
     *                       When downloading a text dataset, transferMode should be either `TransferMode.ASCII`
     *                       so that z/OS FTP service converts `EBCDIC` characters to `ASCII`.
     * @param {boolean} stream - `true` if you want to obtain a `ReadStream` of the data set content, or `false`
     *                           to read a full dataset into memory (in Buffer). The buffer accepts up to 4MB data.
     *                           For large dataset, use `stream=true` instead.
     * @returns `ReadStream` or `Buffer`
     */
    public async downloadFile(filePath: string, transferMode: TransferMode = TransferMode.ASCII,
                              stream = false): Promise<Buffer | ReadStream> {
        return await this.download(filePath, transferMode, stream);
    }

    private async list(dsn: string) {
        const deferred = Q.defer<Entry[]>();
        const ftpClient = this.client;
        ftpClient.site('FILETYPE=SEQ ISPFSTATS', (err: Error) => {
            if (err) {
                return deferred.reject(err);
            }
            dsn = Utils.ensureFullQualifiedDSN(dsn);
            ftpClient.list(dsn, (err1: FtpError, list: string[]) => {
                if (err1) {
                    if (err1.code === 550 && list === undefined && /No [\s\w]+ found/.test(err1.message)) {
                        // "No data sets found" or "No members found"
                        deferred.resolve([]);
                    } else {
                        deferred.reject(err1);
                    }
                } else {
                    if (list[0].match(/^total/)) {
                        list.shift();  // Pop header
                        deferred.resolve(parseUSSDirList(list, this.migrationMode));
                    } else if (list[0].indexOf('Volume') >= 0 && list[0].indexOf('Dsname') >= 0) {
                        deferred.resolve(parseDataSets(list, this.migrationMode));
                    } else if (list[0].indexOf('Name') >= 0 && list[0].indexOf('Id') >= 0) {
                        deferred.resolve(parsePDSMembers(list, this.migrationMode));
                    } else if (list[0].indexOf('Name') >= 0 && list[0].indexOf('Amode') >= 0) {
                        deferred.resolve(parseLoadLibPDSMembers(list));
                    } else if (list[0].indexOf(' ') !== -1) {
                        // The following line is returned when listing a regular file or symbolic link.
                        // lrwxrwxrwx   1 USER  GROUP         12 Jul 13  2017 /tmp -> $SYSNAME/tmp
                        // -rw-------   1 USER  GROUP    2152185 Nov  7 20:40 /tmp/abc.txt
                        var items = list[0].split(' ');
                        if (USS_FILE_MODES_REX.test(items[0])) {
                            // The first item must contain the char symbol of file mode, dir, link only.
                            deferred.resolve(parseUSSDirList(list, this.migrationMode));
                        } else {
                            deferred.resolve([]);
                        }
                    } else {
                        deferred.reject(new Error('Unrecognized file list header: ' + list[0]));
                    }
                }
            });
        });
        return deferred.promise;
    }

    /**
     * Lists the datasets whose names match with the given dataset name.
     *
     * @param dsn - Full qualified name of dataset, or datadata name with wildcards (* or ?)
     * @returns Dataset entries
     */
    public async listDatasets(dsn: string): Promise<DatasetEntry[]> {
        const entries = await this.list(dsn);
        return entries.map((entry: Entry) => entry as DatasetEntry);
    }

    /**
     * Lists the members of partition dataset.
     *
     * @param partitionDsn - Full qualified name of patition dataset
     * @returns Dataset member entries
     */
    public async listMembers(partitionDsn: string): Promise<DatasetMemberEntry[]> {
        const entries = await this.list(`${Utils.removeQuote(partitionDsn)}(*)`);
        return entries.map((entry: Entry) => entry as DatasetMemberEntry);
    }

    /**
     * Lists files whose names match with the given path name.
     *
     * @param dirPath - Directory to list or file name with widecards (* or ?)
     * @returns USS file entries
     */
    public async listFiles(dirPath: string): Promise<USSEntry[]> {
        const entries = await this.list(dirPath);
        return entries.map((entry: Entry) => entry as USSEntry);
    }

    /**
     * Deletes the dataset or member of parition datate whose names match with the given dataset name.
     *
     * @param dsn - Full qualified name of dataset. The datadata name with wildcards (* or ?) is not supported.
     */
    public async deleteDataset(dsn: string): Promise<void> {
        const deferred = Q.defer<void>();
        const dataset = Utils.ensureFullQualifiedDSN(dsn);
        const ftpClient = this.client;
        ftpClient.site('FILETYPE=SEQ', (err: Error) => {
            if (err) {
                return deferred.reject(err);
            }
            ftpClient.delete(dataset, (err1: Error) => {
                if (err1) {
                    deferred.reject(err1);
                } else {
                    deferred.resolve();
                }
            });
        });
        return deferred.promise;
    }

    /**
     * Deletes the USS files or directory whose names match with the given file path.
     *
     * @param filePath - The path name of USS file or directory. The path name with wildcards (* or ?) is not supported.
     * @param fileType - Either FILE_OR_DIRECTORY or WHOLE_DIRECTORY
     */
    public async deleteFile(filePath: string,
                            fileType: FileToOperate = FileToOperate.FILE_OR_DIRECTORY): Promise<void> {
        const deferred = Q.defer<void>();
        const ftpClient = this.client;
        ftpClient.site('FILETYPE=SEQ', async (err: Error) => {
            if (err) {
                return deferred.reject(err);
            } else if (fileType === FileToOperate.WHOLE_DIRECTORY) {
                const list = await this.listFiles(filePath);
                for (const item of list) {
                    const entry = item as USSEntry;
                    if (entry.fileType === FileType.DIRECTORY) {
                        await this.deleteFile(path.join(filePath, entry.name), FileToOperate.WHOLE_DIRECTORY);
                    } else {
                        await this.deleteFile(path.join(filePath, entry.name), FileToOperate.FILE_OR_DIRECTORY);
                    }
                }
                await this.deleteFile(filePath, FileToOperate.FILE_OR_DIRECTORY);
                deferred.resolve();
            } else {
                ftpClient.delete(filePath, (err1: Error) => {
                    if (err1) {
                        deferred.reject(err1);
                    } else {
                        deferred.resolve();
                    }
                });
            }
        });
        return deferred.promise;
    }

    private async rename(name: string, newName: string): Promise<void> {
        const deferred = Q.defer<void>();
        const oldFQD = Utils.ensureFullQualifiedDSN(name);
        const newFQD = Utils.ensureFullQualifiedDSN(newName);
        const ftpClient = this.client;
        ftpClient.site('FILETYPE=SEQ', (err: Error) => {
            if (err) {
                return deferred.reject(err);
            }
            ftpClient.rename(oldFQD, newFQD, (err1: Error) => {
                if (err1) {
                    deferred.reject(err1);
                } else {
                    deferred.resolve();
                }
            });
        });
        return deferred.promise;
    }

    /**
     * Renames dataset, member in partition dataset.
     *
     * @param dsn Current name
     * @param newDsn New name
     */
    public async renameDataset(dsn: string, newDsn: string): Promise<void> {
        return await this.rename(dsn, newDsn);
    }

    /**
     * Renames USS file/directory.
     *
     * @param name Current name
     * @param newName New name
     */
    public async renameFile(name: string, newName: string): Promise<void> {
        return await this.rename(name, newName);
    }

    /**
     * Lists the jobs matching the given query option. If the query option is not provided, it will list all jobs
     * of the current user.
     *
     * @param queryOption - Option which contains
     *                          jobName: Job name, which is optional and can contain a wildcard (*)
     *                          jobId:   Job ID, which is optional
     *                          owner:   Job owner, which is optional and can contain a wildcard (*)
     *                          status:  Job status, eg. ALL, OUTPUT, which is optional
     * @returns List of jobs
     */
    public async listJobs(queryOption?: JobListOption): Promise<Job[]> {
        const deferred = Q.defer<Job[]>();
        const ftpClient = this.client;

        let option: JobListOption = {
            jobName: '',
        };
        if (queryOption === undefined) {
            // Default queryOption is job name for compatibility.
            option = { jobName: '*', owner: this.username, status: 'ALL' };
        } else {
            option.jobName = queryOption.jobName || '*';
            option.jobId = queryOption.jobId;
            option.owner = queryOption.owner || this.username;
            option.status = queryOption.status || 'ALL';
        }

        ftpClient.ascii((err: Error) => {
            if (err) {
                return deferred.reject(err);
            }

            const pathToList = option.jobId || '*';

            const siteParams = ['FILETYPE=JES'];
            siteParams.push(`JESJOBNAME=${option.jobName}`);
            siteParams.push(`JESOWNER=${option.owner}`);
            siteParams.push(`JESSTATUS=${option.status}`);

            // Issue command like "site FILETYPE=JES JESJOBNAME=H* JESOWNER=* JESSTATUS=ALL"
            ftpClient.site(siteParams.join(' '), (err1: Error) => {
                if (err1) {
                    return deferred.reject(err1);
                }
                ftpClient.list(pathToList, (err2: FtpError, list: string[]) => {
                    if (err2) {
                        if (err2.code === 550) {
                            // No job is found.
                            deferred.resolve([]);
                        } else {
                            deferred.reject(err2);
                        }
                    } else {
                        deferred.resolve(parseJobList(list));
                    }
                });
            });
        });
        return deferred.promise;
    }

    /**
     * Returns the status the job identified by job id and optional job name.
     *
     * @param queryOption - Option which contains
     *                          jobId:   Job ID, which is required
     *                          owner:   Job owner, which is optional
     * @returns List of job status
     */
    public async queryJob(queryOption: JobIdOption): Promise<JobStatusResult> {
        const option: JobListOption = {
            jobId: queryOption.jobId,
            owner: queryOption.owner || this.username,
        };

        return this.listJobs(option).then((jobs: Job[]) => {
            for (const job of jobs) {
                if (job.jobId && queryOption.jobId && job.jobId.toUpperCase() === queryOption.jobId.toUpperCase()) {
                    if (job.status === 'INPUT') {
                        return JobStatusResult.WAITING;
                    } else if (job.status === 'HELD') {
                        return JobStatusResult.FAIL;
                    } else if (job.status === 'ACTIVE') {
                        return JobStatusResult.ACTIVE;
                    } else if (job.status === 'OUTPUT') {
                        if (job.extra && job.extra.indexOf('RC=0000') !== -1) {
                            // 'EZA2284I JOB17459 USER1 OUTPUT A        RC=0000 6 spool files',
                            return JobStatusResult.SUCCESS;
                        } else if (job.extra && job.extra.indexOf('ABEND=') !== -1) {
                            // 'EZA2284I JOB00083 USER1 OUTPUT A ABEND=806 3 spool files',
                            return JobStatusResult.FAIL;
                        } else if (job.extra && job.extra.indexOf('JCL error') !== -1) {
                            // 'EZA2284I JOB00082 USER1 OUTPUT A (JCL error) 3 spool files',
                            return JobStatusResult.FAIL;
                        } else {
                            const deferred = Q.defer<JobStatusResult>();
                            this.getJobStatus({ jobId: queryOption.jobId, owner: option.owner })
                                .then((jobStatus: JobStatus) => {
                                    if (jobStatus.rc === 0) {
                                        deferred.resolve(JobStatusResult.SUCCESS);
                                    } else {
                                        deferred.resolve(JobStatusResult.FAIL);
                                    }
                                });
                            return deferred.promise;
                        }
                    }
                    return JobStatusResult.FAIL;
                }
            }
            return JobStatusResult.NOT_FOUND;
        });
    }

    /**
     * Returns the job RC by reading JESMSGLG.
     *
     * @param queryOption - Option which contains
     *                          jobId:   Job ID, which is required
     *                          owner:   Specify a JES job owner, which is optional and can contain a wildcard (*)
     * @returns RC number or error string
     */
    public async getRCFromJESMSGLG(queryOption: JobLogOption): Promise<number | string> {
        return this.getJobLog(queryOption).then((log: string | SpoolFile[]) => {
            let rc;
            const logContents = log as string;
            if (logContents) {
                const EYE_CATCHER_1 = 'ENDED - RC=';
                const EYE_CATCHER_2 = 'ENDED - ABEND=';
                const EYE_CATCHER_3 = 'NOT AUTHORIZED';
                logContents.split('\n').forEach((line: string) => {
                    const posn1 = line.indexOf(EYE_CATCHER_1);
                    const posn2 = line.indexOf(EYE_CATCHER_2);
                    const posn3 = line.indexOf(EYE_CATCHER_3);
                    if (posn1 !== -1) {
                        rc = parseInt(line.substring(posn1 + EYE_CATCHER_1.length).trim(), 10);
                        } else if (posn2 !== -1) {
                        rc = 'ABEND ' + line.substring(posn2 + EYE_CATCHER_2.length).trim();
                        } else if (posn3 !== -1) {
                        rc = 'SEC ERROR';
                        }
                    });
            }
            if (typeof(rc) === 'number') {
                rc = parseInt(rc, 10);
            }
            return Q.resolve(rc);
        });
    }

    /**
     * Returns the status of the job specified by query option. Example of the returned job status:
     *
     * ```
     *  {
     *      jobname: "HRECALLW",
     *      jobid: "JOB06385",
     *      owner: "USER",
     *      status: "OUTPUT",
     *      class: "A",
     *      rc: 0,
     *      spoolFiles: [
     *         {
     *          id: 2,
     *          stepName: "JES2",
     *          procStep: "N/A",
     *          class: "H",
     *          ddName: "JESJCL",
     *          byteCount: 315
     *        }
     *      ]
     * }
     * ```
     *
     * @param queryOption - Option which contains
     *                          jobId:   Job ID, which is required
     *                          owner:   Job owner, which is optional and can contain a wildcard (*)
     * @returns Job status
     */
    public async getJobStatus(queryOption: JobIdOption): Promise<JobStatus> {
        const deferred = Q.defer<JobStatus>();
        const ftpClient = this.client;

        const option: JobIdOption = {
            jobId: queryOption.jobId,
            owner: queryOption.owner || this.username,
        };

        if (option.jobId === undefined) {
            throw new Error('The job ID is required.');
        }

        ftpClient.ascii((err: Error) => {
            if (err) {
                return deferred.reject(err);
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            ftpClient.site(`FILETYPE=JES SBSENDEOL=CRLF JESJOBNAME=* JESOWNER=${option.owner}`, (err1: Error) => {
                if (err1) {
                    return deferred.reject(err1);
                }
                ftpClient.list(option.jobId as string, (err2: Error, list: string[]) => {
                    /* Expected list response
                    JOBNAME  JOBID    OWNER    STATUS CLASS
                    HRECALLW JOB02094 VPADEV   INPUT  A

                    or

                    JOBNAME  JOBID    OWNER    STATUS CLASS
                    HRECALLW JOB02094 VPADEV   ACTIVE A
                    --------
                            STEPNAME HRECALL  PROCNAME        N/A
                            CPUTIME     0.012 ELAPSED TIME    117.515

                    or

                    JOBNAME  JOBID    OWNER    STATUS CLASS
                    HRECALLW JOB02094 VPADEV   OUTPUT A        RC=0000
                    --------
                            ID  STEPNAME PROCSTEP C DDNAME   BYTE-COUNT
                            001 JES2        N/A   H JESMSGLG      1582
                            002 JES2        N/A   H JESJCL         324
                            003 JES2        N/A   H JESYSMSG       978
                    3 spool files
                    **/
                    if (err2) {
                        return deferred.reject(err2);
                    }

                    const jobDescIndex = list.findIndex((line: string) => {
                        return /^\s*JOBNAME\s+/i.test(line);
                    });
                    if (jobDescIndex === -1) {
                        return deferred.reject(new Error('Cannot find job header line'));
                    }
                    const job = parseJobLine(list[jobDescIndex + 1].trim());
                    const jobStatus: JobStatus = { ...job } as JobStatus;

                    if (jobStatus.extra) {
                        jobStatus.extra.split(/\s+/).forEach((entry: string) => {
                            const pair: string[] = entry.split('=');
                            if (pair.length === 2) {
                                if (pair[0].toUpperCase() === 'RC') {
                                    jobStatus.rc = parseInt(pair[1], 10);
                                    jobStatus.retcode = pair[0] + ' ' + pair[1];
                                }
                            }
                        });
                    }

                    // For TSO users
                    //  No proper data to cover this so far.
                    //
                    // const tsoFieldsIndex = list.findIndex((line: string) => {
                    //     return /^\s+STEPNAME\s+/i.test(line);
                    // });
                    // if (tsoFieldsIndex !== -1) {
                    //     const tsoFieldStr = list[tsoFieldsIndex] + ' ' + list[tsoFieldsIndex + 1];
                    //     const fields = tsoFieldStr.split(/\s+(?!TIME)/i);
                    //     for (let i = 0; i < fields.length; i += 2) {
                    //         jobStatus[fields[i].toLowerCase()] = fields[i + 1];
                    //     }
                    // }

                    // Spool files
                    const spoolFileIndex = list.findIndex((line: string) => {
                        return /^\s+ID\s+/i.test(line);
                    });
                    if (spoolFileIndex !== -1) {
                        // Spool file will be available when job finished
                        jobStatus.spoolFiles = parseSpoolTable(list.slice(spoolFileIndex), this.migrationMode);
                    }

                    // USER  TSU18242 USER  OUTPUT TSU      ABEND=622 1 spool files
                    // USER  JOB00256 USER  OUTPUT A        (JCL error) 3 spool files
                    const extra = jobStatus.extra as string;
                    if (extra && (extra.includes('error'))) {
                        jobStatus.rc = extra;
                        jobStatus.retcode = 'JCL ERROR';
                        deferred.resolve(jobStatus);
                        return;
                    } else if (extra && (extra.includes('ABEND='))) {
                        jobStatus.rc = extra;
                        jobStatus.retcode = extra.replace('=', ' ');
                        deferred.resolve(jobStatus);
                        return;
                    }

                    // If job finished, while FTP doesn't provide RC
                    if (jobStatus.status === 'OUTPUT' && (jobStatus.rc === undefined)) {
                        const spoolFiles = jobStatus.spoolFiles as SpoolFile[];
                        if (spoolFiles !== undefined) {
                        // Read RC from JESMSGLG
                        const file = spoolFiles.find((spoolFile: SpoolFile) => {
                            return spoolFile.ddName === 'JESMSGLG';
                        });
                        if (file) {
                            const optionForJESMSGLG: JobLogOption = {
                                fileId: file.id,
                                jobId: option.jobId,
                                owner: option.owner,
                        };
                            this.getRCFromJESMSGLG(optionForJESMSGLG).then((rc: number | string) => {
                                jobStatus.rc = rc;
                                if (typeof(rc) === 'number' && isNaN(rc) === false) {
                                   jobStatus.retcode = 'RC ' + (Array(4).join('0') + rc).slice(-4);
                                } else {
                                   jobStatus.retcode = rc.toString();
                                }
                                deferred.resolve(jobStatus);
                                });
                        } else {
                            deferred.resolve(jobStatus);
                        }}
                    } else {
                        deferred.resolve(jobStatus);
                    }
                });
            });
        });
        return deferred.promise;
    }

    /**
     * Returns job spool files identified by jobId.
     *
     * @param queryOption - Option which contains
     *                          jobId:   Job ID, which is required
     *                          fileId:  Spool file index (1, 2, 3...) or
     *                                      -1 - return all spool files joined with the `!! END OF JES SPOOL FILE !!`
     *                          owner:   Specify a JES job owner, which is optional and can contain a wildcard (*)
     * @return Job log file contents
     */
    public async getJobLog(queryOption: JobLogOption): Promise<string> {
        const deferred = Q.defer<string>();
        const ftpClient = this.client;

        const option: JobLogOption = {
            fileId: queryOption.fileId || -1,
            jobId: queryOption.jobId,
            owner: queryOption.owner || this.username,
        };

        if (option.jobId === undefined) {
            throw new Error('The job ID is required.');
        }

        ftpClient.ascii((err: Error) => {
            if (err) {
                return deferred.reject(err);
            }
            const siteParams = ['FILETYPE=JES'];
            siteParams.push('SBSENDEOL=CRLF')
            siteParams.push(`JESJOBNAME=*`);
            siteParams.push(`JESOWNER=${option.owner}`);

            const site = siteParams.join(' ');
            ftpClient.site(site, (err1: Error) => {
                if (err1) {
                    return deferred.reject(err1);
                }
                const jobLogID = option.fileId === -1 ? `${option.jobId}.x` : `${option.jobId}.${option.fileId}`;
                ftpClient.get(jobLogID, (err2: Error, readStream: ReadStream) => {
                    if (err2) {
                        return deferred.reject(err2);
                    }
                    const chunks: Buffer[] = [];
                    readStream.on('data', (chunk: Buffer) => {
                        chunks.push(chunk);
                    });
                    readStream.on('end', () => {
                        const logString = Buffer.concat(chunks).toString('utf8');
                        return deferred.resolve(logString);
                    });
                    readStream.on('error', (err3: Error) => {
                        deferred.reject(err3);
                    });
                    readStream.resume();
                });
            });
        });
        return deferred.promise;
    }

    /**
     * Deletes the job of the specified job id.
     *
     * @param queryOption - Option which contains
     *                          jobId:   Job ID, which is required
     *                          owner:   Job owner, which is optional and can contain a wildcard (*)
     */
    public async deleteJob(queryOption: JobIdOption): Promise<void> {
        const deferred = Q.defer<void>();
        const ftpClient = this.client;

        const option: JobIdOption = {
            jobId: queryOption.jobId,
            owner: queryOption.owner || this.username,
        };

        if (option.jobId === undefined) {
            throw new Error('The job ID is required.');
        }

        ftpClient.site('FILETYPE=JES JESJOBNAME=*', (err: Error) => {
            if (err) {
                return deferred.reject(err);
            }
            ftpClient.delete(option.jobId as string, (err1: Error) => {
                if (err1) {
                    deferred.reject(err1);
                } else {
                    deferred.resolve();
                }
            });
        });
        return deferred.promise;
    }

    /**
     * Submits job with the specified JCL text.
     *
     * @param jclText JCL text to submit
     * @return Job ID
     */
    public async submitJCL(jclText: string): Promise<string> {
        const deferred = Q.defer<string>();
        const ftpClient = this.client;
        if (typeof jclText === 'string') {
            // FTP server requires ascii text ends with \r\n
            jclText = jclText.replace(/\r?\n/g, '\r\n');
        }
        ftpClient.ascii((err: Error) => {
            if (err) {
                return deferred.reject(err);
            }
            ftpClient.site('FILETYPE=JES', (err1: Error) => {
                if (err1) {
                    return deferred.reject(err1);
                }
                ftpClient.put(Buffer.from(jclText), 'PLACEHOL', (err2: Error, text: string) => {
                    if (err2) {
                        deferred.reject(err2);
                    } else {
                        const matched = text.match(/JES as (\w+)\s/i);
                        if (!matched || matched.length !== 2) {
                            deferred.reject(new Error('Failed to submit jcl, job id not found'));
                        } else {
                            deferred.resolve(matched[1]);
                        }
                    }
                });
            });
        });
        return deferred.promise;
    }

    /**
     * Convert allocate params object to name/value pair string.
     */
    private allocateParamsToString(allocateParams?: AllocateParams): string {
        if (allocateParams === undefined) {
            return '';
        }

        if (typeof allocateParams === 'string') {
            return allocateParams;
        }

        const params = [];
        // allocateParams is an object
        for (const key in allocateParams || {}) {
            if (!allocateParams.hasOwnProperty(key)) {
                continue;
            }
            if (allocateParams[key] === true) {
                params.push(key.toUpperCase());
            } else {
                params.push(key.toUpperCase() + '=' + allocateParams[key]);
            }
        }
        return params.join(' ');
    }
}

export {
    ZosAccessor,
};

