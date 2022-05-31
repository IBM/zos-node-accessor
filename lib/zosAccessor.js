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


// DO NOT use strict mode, otherwise `arguments.callee.caller` will fail
// 'use strict';

var Parser = require('ftp4/lib/parser');
Parser.parseListEntry = function (line) {
    return line;
};
var Client = require('ftp4');
var debug = require('debug')('zos-accessor');
var Q = require('q');

var USS_FILE_MODES_REX = /^[dlrwx\-]+$/;

function ZosAccessor() {
    this.client = new Client();
    this.connected = false;
}

module.exports = ZosAccessor;

/**
 * Connect to z/OS via FTP, valid config properties:
 *
 * user - Username for authentication on z/OS.
 * password - Password for authentication on z/OS.
 * host - The hostname or IP address of the z/OS server to connect to, default is 'localhost'.
 * port - The port of the z/OS FTP server, default is 21.
 * secure - Set to true for both control and data connection encryption, 'control' for control connection encryption only, or 'implicit' for implicitly encrypted control connection (this mode is deprecated in modern times, but usually uses port 990), default is false.
 * secureOptions - Additional options to be passed to `tls.connect()`, default is (none)
 * connTimeout - How long (in milliseconds) to wait for the control connection to be established, default is 10000.
 * pasvTimeout - How long (in milliseconds) to wait for a PASV data connection to be established, default is 10000.
 * keepalive - How often (in milliseconds) to send a 'dummy' (NOOP) command to keep the connection alive, default is 10000.
 */
ZosAccessor.prototype.connect = function (options) {
    var deferred = Q.defer();
    var self = this;
    self.username = options.user;
    this.client.on('ready', function () {
        self.connected = true;
        deferred.resolve(self);
    }).on('error', function (err) {
        self.connected = false;
        deferred.reject(err);
    }).on('close', function (hasErr) {
        self.connected = false;
        debug('User', self.username, 'disconnected from ftp.');
    });
    this.client.connect(options);
    return deferred.promise;
};

/**
 * Close connection to z/OS
 */
ZosAccessor.prototype.close = function () {
    this.client.end();
};

//==================================Dataset related operations=================

/**
 * Convert allocate params object to name/value pair string.
 */
function allocateParamsToString(allocateParams) {
    if (typeof allocateParams === 'string') {
        return allocateParams.toUpperCase();
    }

    var params = [];
    // allocateParams is an object
    for (var key in allocateParams || {}) {
        if (!allocateParams.hasOwnProperty(key)) {
            continue;
        }
        if (allocateParams[key] === true) {
            params.push(key.toUpperCase());
        } else {
            params.push(key.toUpperCase() + '=' + allocateParams[key]);
        }
    }
    return params.join(' ').toUpperCase();
}

/**
 * Makes USS directory with the given directory name.
 * 
 * @param {string} directoryName - Directory name
 */
ZosAccessor.prototype.makeDirectory = function(directoryName) {
    var ftpClient = this.client;
    var deferred = Q.defer();
    ftpClient.mkdir(directoryName, function (err) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve();
        }
    });
    return deferred.promise;
}

/**
 * Allocate sequential or partition (with the DCB attribut "PDSTYPE=PDS") dataset. 
 *
 * @param {string} datasetName - Dataset name to allocate
 * @param {object|string} allocateParams - A string of space separated DCB attributes or an object of DCB attribute key-value pairs,
 *            eg. "LRECL=80 RECFM=VB" or {"LRECL": 80, "RECFM": "VB"}. These attributes are transferred as FTP site sub commands.
 *            The tested attributes includes BLKsize/BLOCKSIze, BLocks, CYlinders, Directory, LRecl, PDSTYPE, PRImary, RECfm, SECondary, and TRacks.
 */
ZosAccessor.prototype.allocateDataset = function(datasetName, allocateParams) {
    var self = this;
    var ftpClient = this.client;
    datasetName = ensureFullQualifiedDSN(datasetName);
    return self.listDataset(datasetName).then(function (datasetList) {
        if (datasetList.length) {
            throw new Error('Dataset ' + datasetName + ' already exists');
        }

        var allocateParamString = allocateParamsToString(allocateParams);
        if (allocateParamString.indexOf("DSORG=PO") !== -1 ||
            allocateParamString.indexOf("PDSTYPE=PDS") !== -1 ||
            allocateParamString.indexOf("PDSTYPE=PDSE") !== -1) {
            // Remove DSORG since it's not valid site sub command.
            allocateParamString = allocateParamString.replace("DSORG=PO", "");
            // Allocate an PDS dataSet
            var deferred = Q.defer();
            ftpClient.site(allocateParamString, function (err, responseText, responseCode) {
                if (err) {
                    return deferred.reject(err);
                }
                ftpClient.mkdir(datasetName, function (err) {
                    if (err) {
                        deferred.reject(err);
                    } else {
                        deferred.resolve();
                    }
                });
            });
            return deferred.promise;
        } else {
            // Allocate a seq dataSet
            // Upload a space here, because an empty Buffer may cause the "connection reset" error.
            return self.uploadDataset(Buffer.from(' '), datasetName, undefined, allocateParams);
        }
    });
};

/**
 * Upload data/file to the server to be stored as destDataset
 *
 * @param {NodeJS.ReadableStream|Buffer|string} input - Can be a ReadableStream, a Buffer, or a path to a local file.
 * @param {string} destDataset - Dataset name to used to store the uploaded file.
 * @param {string} dataType - Transfer data type, it should be 'ascii' or 'binary',
 *            when transfering 'ascii' files, the end-of-line sequence of input should always be '\r\n',
 *            otherwise the transfered file will get truncated.
 * @param {object|string} allocateParams - A string of space separated DCB attributes or an object of DCB attribute key-value pairs.
 *            eg. "LRECL=80 RECFM=VB" or {"LRECL": 80, "RECFM": "VB"}. 
 *            The tested attributes: BLKsize/BLOCKSize, LRecl, RECfm, PRImary, SECondary, TRacks
 *            
 */
ZosAccessor.prototype.uploadDataset = function(input, destDataset, dataType, allocateParams) {
    var deferred = Q.defer();
    var ftpClient = this.client;
    dataType = dataType || 'ascii';
    if(dataType !== 'ascii' && dataType !== 'binary') {
        throw new Error('Unsupported data type: ' + dataType);
    }

    var siteParams = ['FILETYPE=SEQ'];
    var allocateParamString = allocateParamsToString(allocateParams);
    siteParams.push(allocateParamString);

    ftpClient[dataType](function (err) {
        if (err) {
            return deferred.reject(err);
        }
        ftpClient.site(siteParams.join(' '), function (err, responseText, responseCode) {
            if (err) {
                return deferred.reject(err);
            }
            destDataset = ensureFullQualifiedDSN(destDataset);
            ftpClient.put(input, destDataset, function (err) {
                if (err) {
                    deferred.reject(err);
                } else {
                    deferred.resolve();
                }
            });
        });
    });
    return deferred.promise;
};

/**
 * Download dataset.
 *
 * @param {string} dsn - Dataset name
 * @param {string} dataType - 'ascii' or 'binary' or 'ascii_strip_eol' or 'ascii_rdw' or 'binary_rdw'
 * @param {boolean} stream - Resolve stream as result or not
 */
ZosAccessor.prototype.getDataset = function (dsn, dataType, stream) {
    var deferred = Q.defer();
    var ftpClient = this.client;
    dataType = dataType || 'ascii';
    if(dataType !== 'ascii' && dataType !== 'binary' && dataType !== 'ascii_strip_eol' && dataType !== 'ascii_rdw' && dataType !== 'binary_rdw') {
        throw new Error('Unsupported data type: ' + dataType);
    }
    var sbsendeol = 'SBSENDEOL=CRLF';
    var rdw = '';
    if (dataType === 'ascii_strip_eol') {
        sbsendeol = 'SBSENDEOL=NONE';
        dataType = 'ascii';
        rdw = '';
    }
    if (dataType === 'ascii_rdw') {
        dataType = 'ascii';
        rdw = 'rdw';
    } else if (dataType === 'binary_rdw') {
        dataType = 'binary';
        rdw = 'rdw';
    }
    var siteParams = [];
    siteParams.push('FILETYPE=SEQ');
    siteParams.push('TRAILINGBLANKS');
    siteParams.push(sbsendeol);
    siteParams.push(rdw);
    ftpClient[dataType](function (err) {
        if (err) {
            return deferred.reject(err);
        }
        ftpClient.site(siteParams.join(' '), function (err, responseText, responseCode) {
            if (err) {
                return deferred.reject(err);
            }
            dsn = ensureFullQualifiedDSN(dsn);
            ftpClient.get(dsn, function (err, readStream) {
                if (err) {
                    return deferred.reject(err);
                }
                if (stream) {
                    return deferred.resolve(readStream);
                }
                var chunks = [];
                readStream.on('data', function (chunk) {
                    chunks.push(chunk);
                });
                readStream.on('end', function () {
                    deferred.resolve(Buffer.concat(chunks));
                });
                readStream.on('error', function (err) {
                    deferred.reject(err);
                });
                readStream.resume();
            });
        });
    });
    return deferred.promise;
};

/**
 * List a dataset
 *
 * @param {string} dsn - Specify a full qualified dataset name, supporting wildcards (* or ?), PDS members (HLQ.JCL(*)) and USS directory.
 */
ZosAccessor.prototype.listDataset = function (dsn) {
    var deferred = Q.defer();
    var ftpClient = this.client;
    var self = this;
    ftpClient.site('FILETYPE=SEQ ISPFSTATS', function (err, responseText, responseCode) {
            if (err) {
                return deferred.reject(err);
            }
            dsn = ensureFullQualifiedDSN(dsn);
            ftpClient.list(dsn, function (err, list) {
                if (err) {
                    if (err.code === 550 && list === undefined && /No [\s\w]+ found/.test(err.message)) {
                        // "No data sets found" or "No members found"
                        deferred.resolve([]);
                    } else {
                        deferred.reject(err);
                    }
                } else {
                    if (list[0].match(/^total/)) {
                        list.shift();  // Pop header
                        deferred.resolve(self.parseUSSDirList(list));
                    } else if (list[0].indexOf('Volume') >= 0 && list[0].indexOf('Dsname') >= 0) {
                        deferred.resolve(self.parseMVSDataSets(list));
                    } else if (list[0].indexOf('Name') >= 0 && list[0].indexOf('Id') >= 0) {
                        deferred.resolve(self.parsePDSMembers(list));
                    } else if (list[0].indexOf('Name') >= 0 && list[0].indexOf('Amode') >= 0) {
                        deferred.resolve(self.parseLoadLibPDSMembers(list));
                    } else if (list[0].indexOf(' ') !== -1) {
                        // The following line is returned when listing a regular file or symbolic link.
                        // lrwxrwxrwx   1 USER  GROUP         12 Jul 13  2017 /tmp -> $SYSNAME/tmp
                        // -rw-------   1 USER  GROUP    2152185 Nov  7 20:40 /tmp/abc.txt
                        var items = list[0].split(' ');
                        if (USS_FILE_MODES_REX.test(items[0])) {
                            // The first item must contain the char symbol of file mode, dir, link only.
                            deferred.resolve(self.parseUSSDirList(list));
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
};

/**
 * Parse a list of USS directory list strings
 */
ZosAccessor.prototype.parseUSSDirList = function (dirList) {
    var monthText = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var headers = ['permissions', 'links', 'owner', 'group', 'size'];
    var entries = [];
    dirList.forEach(function (line) {
        var entry = {rawString: line};
        var item = line.substring(0, 'lrwxrwxrwx'.length);
        if (!USS_FILE_MODES_REX.test(item)) {
            return;
        }
        var fields = line.split(/\s+/);
        for(var i=0; i<headers.length; ++i) {
            entry[headers[i]] = fields[i];
        }
        if (entry['permissions'] && entry['permissions'].length > 0 && entry['permissions'][0]) {
            // drwx------
            entry['isDirectory'] = entry['permissions'][0] === 'd';
        }
        if (fields[7].indexOf(':') === -1) {
            // May  8  2017
            entry['lastModified'] = new Date(fields[7], monthText.indexOf(fields[5]), fields[6]);
        } else {
            // Oct  2 09:48
            var now = new Date();
            entry['lastModified'] = new Date(now.getFullYear(), monthText.indexOf(fields[5]), fields[6]);
        }
        entry['name'] = fields.slice(8).join(' ');
        entries.push(entry);
    });
    return entries;
};

/**
 * Parse a list of MVS dataset list strings
 */
ZosAccessor.prototype.parseMVSDataSets = function (dirList) {
    var headLine = dirList.shift();
    var footLine = dirList[dirList.length-1];
    if (footLine.toLowerCase().indexOf('list completed successfully') !== -1) {
        dirList.pop();
    }

    //            1         2         3         4         5         6         7         8
    //  012345678901234567890123456789012345678901234567890123456789012345678901234567890
    // 'Volume Unit    Referred Ext Used Recfm Lrecl BlkSz Dsorg Dsname',
    // 'XRFS79 3390   2017/08/04  1 4080  FB    1024 27648  PS  \'USERHLQI.T1.HISPAXZ\'',
    // 'XRFS95 3390   2017/08/04  313875  FB    1024 27648  PS  \'USERHLQI.T2.HISPAXZ\'',
    // 'XRFS61 3390   2017/08/04  1 4500  FB    1024 27648  PS  \'USERHLQI.T3.HISPAXZ\'',
    // 'XRFS67 3390   2017/08/04  314760  FB    1024 27648  PS  \'USERHLQI.T4.HISPAXZ\''

    var headers = headLine.split(/\s+/);
    var positions = [ ];
    var lastPosition = 0;
    headers.forEach(function(header) {
        // No header is substring of another header.
        var position = { start: lastPosition, end: headLine.indexOf(header) + header.length };
        positions.push(position);
        lastPosition = position.end;
    });

    var entries = [];
    dirList.forEach(function (line) {
        var entry = {rawString: line};
        var fields = line.split(/\s+/);

        // The Migrated line is special. Process this special case first.
        if (fields[0] === 'Migrated' && fields.length > 1) {
            entry[headers[0]] = 'Migrated';
            var dsname = fields[fields.length - 1];
            entry['Dsname'] = stripQuotes(dsname);
        } else {
            fields = [];
            positions.forEach(function(position, index) {
                var end = position.end;
                if (line.length > end + 1 && line[end] !== ' ' && line[end + 1] === ' ') {
                    // Look one more char, in the following case
                    //
                    // 'Volume Unit    Referred Ext Used Recfm Lrecl BlkSz Dsorg Dsname',
                    // 'XRFS95 3390   2017/08/04  313875  FB    1024 27648  PS  \'USERHLQI.T2.HISPAXZ\'',
                    //                         ^^
                    //                         ||
                    //                         |+--- the char after the end position is ' '
                    //                         +---- the char at the end position is not ' '
                    end ++;

                    // Adjust the next start/end pair
                    positions[index + 1].start = end;
                }
                if (index === positions.length - 1) {
                    end = line.length;
                }
                var field = line.substring(position.start, end);
                fields.push(field.trim());
            });
            if (fields.length === headers.length) {
                for(var i=0; i<headers.length; ++i) {
                    if (fields[i].match(/\d{4}\/\d{2}\/\d{2}/)) {
                        var parts = fields[i].split('/');
                        fields[i] = new Date(parts[0], parts[1]-1, parts[2]); // Note: months are 0-based
                    } else if(headers[i] === 'Dsname') {
                        fields[i] = stripQuotes(fields[i]);
                    }
                    entry[headers[i]] = fields[i];
                }
            }
        }
        entries.push(entry);
    });
    return entries;
};

/**
 * Parse a list of PDS members
 * Name     VV.MM   Created       Changed      Size  Init   Mod   Id
 * JVBR30   01.01 2018/09/07 2018/09/07 03:52    13    13     0  AAA
 *
 * Meaning of each field:
 * name, version.modification, create date, modification date & time,
 * size in lines, size in lines at creation, lines modified, id of user who modified
 */
ZosAccessor.prototype.parsePDSMembers = function (dirList) {
    var headers = dirList.shift().trim().split(/\s+/);
    var entries = [];
    dirList.forEach(function (line) {
        var entry = {rawString: line};
        var fields = line.trim().split(/\s+(?!\d+:)/);
        for(var i=0; i<headers.length; ++i) {
            entry[headers[i]] = fields[i];
        }
        entries.push(entry);
    });
    return entries;
};

ZosAccessor.prototype.parseLoadLibPDSMembers = function (dirList) {
    var headLine = dirList.shift() || '';
    var ATTRIBUTES_HEADER = '--------- Attributes ---------';
    var posn1 = headLine.indexOf(ATTRIBUTES_HEADER);
    var posn2 = posn1 + ATTRIBUTES_HEADER.length;
    var header1 = headLine.substring(0, posn1).trim();
    var header3 = headLine.substring(posn2).trim();
    var positions = parseHeader(header1);
    positions.push({
        header: 'Attributes',
        start: posn1,
        end: posn2
    });
    positions = positions.concat(parseHeader(header3, posn2));

    var entries = [];
    dirList.forEach(function (line) {
        var entry = {rawString: line, fieldNames: []};
        for (var i = 0; i < positions.length; ++i) {
            entry.fieldNames.push(positions[i].header);
            const field = parseField(line, positions[i]);
            entry[positions[i].header] = field;
        }
        entries.push(entry);
    });
    return entries;
};

/**
 * Delete a dataset or USS file.
 *
 * @param {string} dataset - dataset to delete
 */
ZosAccessor.prototype.deleteDataset = function (dataset) {
    var deferred = Q.defer();
    dataset = ensureFullQualifiedDSN(dataset);
    var ftpClient = this.client;
    ftpClient.site('FILETYPE=SEQ', function (err, responseText, responseCode) {
        if (err) {
            return deferred.reject(err);
        }
        ftpClient.delete(dataset, function (err) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve();
            }
        });
    });
    return deferred.promise;
};

/**
 * Renames oldDataset to newDataset.
 *
 * @param {string} oldDataset - old dataset name
 * @param {string} newDataset - new dataset name to rename to
 */
ZosAccessor.prototype.rename = function (oldDataset, newDataset) {
    var deferred = Q.defer();
    oldDataset = ensureFullQualifiedDSN(oldDataset);
    newDataset = ensureFullQualifiedDSN(newDataset);
    var ftpClient = this.client;
    ftpClient.site('FILETYPE=SEQ', function (err, responseText, responseCode) {
        if (err) {
            return deferred.reject(err);
        }
        ftpClient.rename(oldDataset, newDataset, function (err) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve();
            }
        });
    });
    return deferred.promise;
};

//==================================JES related operations=====================

/**
 * List JES jobs matching the given jobName or query option. The following parameters are accepted:
 *
 * @param {string} jobName - specify a JES job name, it can contain a wildcard (*)
 *
 * or
 *
 * @param {object} option - Option which contains
 *    jobName: specify a JES job name, which is optional and can contain a wildcard (*)
 *    jobId:   specify a JES job ID, which is optional
 *    owner:   specify a JES job owner, which is optional and can contain a wildcard (*)
 *    status:  specify a JES job status, eg. ALL, OUTPUT, which is optional
 */
ZosAccessor.prototype.listJobs = function (jobNameOrOption) {
    var deferred = Q.defer();
    var ftpClient = this.client;

    var option = {};
    if (typeof jobNameOrOption === 'string' || jobNameOrOption === undefined) {
        // Default jobNameOrOption is job name for compatibility.
        option = {jobName: jobNameOrOption || '*', owner: this.username, status: 'ALL'};
    } else if (typeof jobNameOrOption === 'object') {
        option.jobName = jobNameOrOption.jobName || '*';
        option.owner = jobNameOrOption.owner || this.username;
        option.status = jobNameOrOption.status || 'ALL';
        if (jobNameOrOption.jobId) {
            option.jobId = jobNameOrOption.jobId;
        }
    } else {
        throw new Error('The first parameter type of listJobs() should be string or object.')
    }

    ftpClient.ascii(function (err) {
        if (err) {
            return deferred.reject(err);
        }
        var siteParams = ['FILETYPE=JES'];
        for(var key in option) {
            if (!option.hasOwnProperty(key)) {
                continue;
            }
            var jesQueryKey = 'JES' + key.toUpperCase();
            siteParams.push(jesQueryKey + '=' + option[key]);
        }

        // Issue command like "site FILETYPE=JES JESJOBNAME=H* JESOWNER=* JESSTATUS=ALL"
        ftpClient.site(siteParams.join(' '), function (err) {
            if (err) {
                return deferred.reject(err);
            }
            ftpClient.list(function (err, list) {
                if (err) {
                    if (err.code === 550) {
                        // No job is found.
                        deferred.resolve([]);
                    } else {
                        deferred.reject(err);
                    }
                } else {
                    deferred.resolve(list);
                }
            });
        });
    });
    return deferred.promise;
};

// Status from JES
ZosAccessor.RC_SUCCESS = 'success';
ZosAccessor.RC_ACTIVE = 'active';
ZosAccessor.RC_FAIL = 'fail';
ZosAccessor.RC_WAITING = 'waiting';
ZosAccessor.RC_NOT_FOUND = 'not found';

/**
 * Get JCL status identified by job name and job id. The following parameters are accepted.
 *
 * @param {string} jobName - Name of the job
 * @param {string} jobId - ID of the job
 *
 * or
 *
 * @param {object} option - Option which contains
 *    jobName: specify a JES job name, which is optional and can contain a wildcard (*)
 *    jobId:   specify a JES job ID, which is required
 *    owner:   specify a JES job owner, which is optional and can contain a wildcard (*)
 */
ZosAccessor.prototype.queryJob = function (jobNameOrOption, jobId) {
    var option = {};
    if (typeof jobNameOrOption === 'string' || jobNameOrOption === undefined) {
        // Default jobNameOrOption is job name for compatibility.
        option = { jobName: jobNameOrOption || '*', jobId: jobId, owner: this.username };
    } else if (typeof jobNameOrOption === 'object') {
        option.jobName = jobNameOrOption.jobName || '*';
        option.jobId = jobNameOrOption.jobId;
        option.owner = jobNameOrOption.owner || this.username;
    } else {
        throw new Error('The first parameter type of queryJob() should be string or object.')
    }

    if (option.jobId === undefined) {
        throw new Error('The job ID is required by queryJob().')
    }

    var self = this;
    return this.listJobs(option).then(function (fileList) {
        // Skil the first line, which is the header line.
        for (var i = 1; i < fileList.length; ++i) {
            var fields = fileList[i].toUpperCase().split(/\s+/);
            // For JESINTERFACELEVEL=2, those fields are JOBNAME, JOBID, OWNER, STATUS, CLASS
            if (fields.length > 3 && fields[1] === option.jobId.toUpperCase()) {
                if(fields[3] === 'INPUT') {
                    return ZosAccessor.RC_WAITING;
                } else if (fields[3] === 'HELD') {
                    return ZosAccessor.RC_FAIL;
                } else if (fields[3] === 'ACTIVE') {
                    return ZosAccessor.RC_ACTIVE;
                } else if (fields[3] === 'OUTPUT') {
                    var remaining = fields.splice(4).join(' ');
                    if (remaining.indexOf('RC=0000') !== -1) {
                        // 'EZA2284I JOB17459 USER1 OUTPUT A        RC=0000 6 spool files',
                        return ZosAccessor.RC_SUCCESS;
                    } else if (remaining.indexOf('ABEND=') !== -1) {
                        // 'EZA2284I JOB00083 USER1 OUTPUT A ABEND=806 3 spool files',
                        return ZosAccessor.RC_FAIL;
                    } else if (remaining.indexOf('JCL ERROR') !== -1) {
                        // 'EZA2284I JOB00082 USER1 OUTPUT A (JCL error) 3 spool files',
                        return ZosAccessor.RC_FAIL;
                    } else {
                        var deferred = Q.defer();
                        self.getJobStatus(option).then(function(jobStatus) {
                            if (jobStatus.rc === 0) {
                                deferred.resolve(ZosAccessor.RC_SUCCESS)
                            } else {
                                deferred.resolve(ZosAccessor.RC_FAIL)
                            }
                        });
                        return deferred.promise;
                    }
                }
                debug('Recognize "' + fileList[i] + '" as a job failure');
                return ZosAccessor.RC_FAIL;
            }
        }
        return ZosAccessor.RC_NOT_FOUND;
    });
};

/**
 * Get job RC by reading JESMSGLG. Its parameter is as same as getJobLog().
 */
ZosAccessor.prototype.getRCFromJESMSGLG = function (option) {
    return this.getJobLog(option).then(function(log) {
        var rc = undefined;
        if (log) {
            const EYE_CATCHER_1 = 'ENDED - RC=';
            const EYE_CATCHER_2 = 'ENDED - ABEND=';
            const EYE_CATCHER_3 = 'NOT AUTHORIZED';
            log.split('\n').forEach(function(line) {
                var posn1 = line.indexOf(EYE_CATCHER_1);
                var posn2 = line.indexOf(EYE_CATCHER_2);
                var posn3 = line.indexOf(EYE_CATCHER_3);
                if (posn1 !== -1) {
                    rc = line.substring(posn1 + EYE_CATCHER_1.length).trim();
                    } else if (posn2 !== -1) {
                    rc = 'ABEND ' + line.substring(posn2 + EYE_CATCHER_2.length).trim();
                    } else if (posn3 !== -1) {
                    rc = 'SEC ERROR'; 
                    }
            });
        }
        if (rc !== undefined) {
            rc = parseInt(rc);
        }
        return rc;
    });
};

/**
 * Get job status specified by jobId or query option. The following parameters are accepted:
 *
 * @param {string} jobId - specify a JES job ID
 *
 * or
 *
 * @param {object} option - Option which contains
 *    jobId:   specify a JES job ID, which is required
 *    owner:   specify a JES job owner, which is optional and can contain a wildcard (*)
 *
 * @returns {object} job status:
 * {
 *  jobname: "HRECALLW",
 *  jobid: "JOB06385",
 *  owner: "USER",
 *  status: "OUTPUT",
 *  class: "A",
 *  rc: 0,
 *  retcode: 'RC 0000',
 *  spoolFiles: [
 *         {
 *          id: 2,
 *          stepname: "JES2",
 *          procstep: "N/A",
 *          c: "H",
 *          ddname: "JESJCL",
 *          byteCount: 315
 *        }
 *  ]}
 */
ZosAccessor.prototype.getJobStatus = function (jobIdOrOption) {
    var deferred = Q.defer();
    var ftpClient = this.client;

    var option = {};
    if (typeof jobIdOrOption === 'string') {
        // Default jobNameOrOption is job name for compatibility.
        option = { jobId: jobIdOrOption, owner: this.username };
    } else if (typeof jobIdOrOption === 'object') {
        option.jobId = jobIdOrOption.jobId;
        option.owner = jobIdOrOption.owner || this.username;
    } else {
        throw new Error('The first parameter type of getJobStatus() should be string or object.')
    }

    if (option.jobId === undefined) {
        throw new Error('The job ID is required by getJobStatus().')
    }

    var self = this;
    ftpClient.ascii(function (err) {
        if (err) {
            return deferred.reject(err);
        }
        ftpClient.site(`FILETYPE=JES SBSENDEOL=CRLF JESJOBNAME=* JESOWNER=${option.owner}`, function (err, responseText, responseCode) {
            ftpClient.list(option.jobId, function (err, list) {
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
                if (err) {
                    return deferred.reject(err);
                }

                var jobDescIndex = list.findIndex(function (line) {
                    return /^\s*JOBNAME\s+/i.test(line);
                });
                if (jobDescIndex === -1) {
                    return deferred.reject(new Error('Cannot find job header line'));
                }
                var jobStatus = {},
                    headers = list[jobDescIndex].toLowerCase().split(/\s+/),
                    jobBody = list[jobDescIndex+1].trim().split(/\s+/);
                headers.forEach(function (headerName, index) {
                    jobStatus[headerName] = jobBody[index];
                });
                if (jobBody.length > headers.length) {
                    // Save extra termination/clarification info
                    jobStatus.extra = jobBody.slice(headers.length).join(' ');
                    jobStatus.extra.split(/\s+/).forEach(function (entry) {
                        var pair = entry.split('=');
                        if (pair.length === 2) {
                            if (/^\d+$/.test(pair[1])) {
                                pair[1] = +pair[1];
                            }
                            jobStatus[pair[0].toLowerCase()] = pair[1];
                            jobStatus['retcode'] = 'RC ' + (Array(4).join('0') + pair[1]).slice(-4);
                        }
                    });
                }

                // For TSO users
                var tsoFieldsIndex = list.findIndex(function (line) {
                    return /^\s+STEPNAME\s+/i.test(line);
                });
                if (tsoFieldsIndex !== -1) {
                    var tsoFieldStr = list[tsoFieldsIndex] + ' ' + list[tsoFieldsIndex+1];
                    var fields = tsoFieldStr.split(/\s+(?!TIME)/i);
                    for (var i=0; i<fields.length; i+=2) {
                        jobStatus[fields[i].toLowerCase()] = fields[i+1];
                    }
                }

                // Spool files
                var spoolFileIndex = list.findIndex(function (line) {
                    return /^\s+ID\s+/i.test(line);
                });
                if (spoolFileIndex !== -1) {
                    // Spool file will be available when job finished
                    jobStatus.spoolFiles = parseSpoolTable(list.slice(spoolFileIndex));
                }

                // USER  TSU18242 USER  OUTPUT TSU      ABEND=622 1 spool files
                // USER  JOB00256 USER  OUTPUT A        (JCL error) 3 spool files
                if (jobStatus['extra'] && (jobStatus['extra'].includes('error'))) {
                    jobStatus['rc'] = jobStatus['extra'];
                    jobStatus['retcode'] = 'JCL ERROR';
                    deferred.resolve(jobStatus);
                    return;
                } else if (jobStatus['extra'] && (jobStatus['extra'].includes('ABEND='))) {
                    jobStatus['rc'] = jobStatus['extra'];
                    jobStatus['retcode'] = jobStatus['extra'].replace('=', ' ');
                    deferred.resolve(jobStatus);
                    return;
                }

                // If job finished, while FTP doesn't provide RC
                if (jobStatus['status'] === 'OUTPUT' && jobStatus['rc'] === undefined) {
                    // Read RC from JESMSGLG
                    var file = jobStatus.spoolFiles.find(function(spoolFile) {
                        return spoolFile.ddname === 'JESMSGLG';
                    });
                    option.fileId = file.id;
                    self.getRCFromJESMSGLG(option).then(function(rc) {
                        jobStatus['rc'] = rc;
                        if (typeof(rc) === 'number' && isNaN(rc) === false) {
                            jobStatus['retcode'] = 'RC ' + (Array(4).join('0') + rc).slice(-4);
                         } else {
                            jobStatus['retcode'] = rc.toString();
                         }
                        deferred.resolve(jobStatus);
                    });
                } else {
                    deferred.resolve(jobStatus);
                }
            });
        });
    });
    return deferred.promise;
};

/**
 *
 * @param {string} spoolFileTable - parse table of the following format
 * ID  STEPNAME PROCSTEP C DDNAME   BYTE-COUNT
 * 001 JES2              H JESMSGLG      1582
 * 002 JES2        N/A   H JESJCL         324
 * 003 JES2        N/A   H JESYSMSG       978
 * @returns {Array}
 */
function parseSpoolTable(spoolFileTable) {
    var headerLine = spoolFileTable[0];
    var headers = [],
        spoolFiles = [];
    // Columns separated in fixed width, not by space
    var columnRange = [],
        rangeStart = 0,
        lastChar = ' ';
    for (var i=0; i<headerLine.length; ++i) {
        if ((/\s/.test(lastChar) && !/\s/.test(headerLine[i])) || i === headerLine.length-1) {
            // If last char is a space, current is not, then we are having a new column
            if (headerLine.substring(rangeStart, i).trim().length) {
                // If current column has non-space value, add it
                columnRange.push({start: rangeStart, end: i});
                headers.push(headerLine.substring(rangeStart, i).trim().toLowerCase().replace(/-\w/g, function(w) {
                    // Convert to CamelCase
                    return w.substring(1).toUpperCase();
                }));
                rangeStart = i;
            }
        }
        lastChar = headerLine[i];
    }
    for (var i=1; i<spoolFileTable.length; ++i) {
        if (/\d+ spool files/.test(spoolFileTable[i])) {
            break;
        }
        var columns = columnRange.map(function (range) {
            return spoolFileTable[i].substring(range.start, range.end).trim();
        }),
            spool = {};  // Spool object to store more info
        headers.forEach(function (headerName, index) {
            if (headerName.length) {
                // TODO: handle hex numbers
                if (/^\d+$/.test(columns[index])) {
                    columns[index] = +columns[index];
                }
                spool[headerName] = columns[index];
            }
        });
        spoolFiles.push(spool);
    }
    return spoolFiles;
}

/**
 * Get JES spool files identified by jobName and jobId. The following parameters are accepted:
 *
 * @param {string} jobName - Optional job name, default to '*'
 * @param {string} jobId - Specify a JES job ID, which is required
 * @param {int|string} fileId - Format of the spool files to return.
 *          Spool file index (1, 2, 3...) - return spool files of specified index,
 *          'x' - return all spool files joined with the `!! END OF JES SPOOL FILE !!`
 *
 * or
 *
 * @param {object} option - Option which contains
 *    jobName: Optional job name, default to '*'
 *    jobId:   Specify a JES job ID, which is required
 *    fileId:  Spool file index (1, 2, 3...) or
 *             'x' - return all spool files joined with the `!! END OF JES SPOOL FILE !!`
 *    owner:   Specify a JES job owner, which is optional and can contain a wildcard (*)
 */
ZosAccessor.prototype.getJobLog = function (jobNameOrOption, jobId, fileId) {
    var deferred = Q.defer();
    var ftpClient = this.client;

    var option = {};
    if (typeof jobNameOrOption === 'string' || jobNameOrOption === undefined) {
        // Default jobNameOrOption is job name for compatibility.
        option.jobName = jobNameOrOption || '*';
        option.jobId = jobId;
        option.owner = this.username;
        if (fileId === 'metaInfo' || fileId === undefined) {
            option.fileId = 'x';
        } else {
            option.fileId = fileId;
        }
    } else if (typeof jobNameOrOption === 'object') {
        option.jobName = jobNameOrOption.jobName || '*';
        option.jobId = jobNameOrOption.jobId;
        option.owner = jobNameOrOption.owner || this.username;
        option.fileId = jobNameOrOption.fileId || 'x';
    } else {
        throw new Error('The first parameter type of getJobLog() should be string or object.')
    }

    if (option.jobId === undefined) {
        throw new Error('The job ID is required by getJobLog().')
    }

    ftpClient.ascii(function (err) {
        if (err) {
            return deferred.reject(err);
        }
        ftpClient.site(`FILETYPE=JES SBSENDEOL=CRLF JESJOBNAME=${option.jobName} JESOWNER=${option.owner}`, function (err, responseText, responseCode) {
            ftpClient.get(option.jobId + '.' + option.fileId, function (err, readStream) {
                if (err) {
                    return deferred.reject(err);
                }
                var chunks = [];
                readStream.on('data', function (chunk) {
                    chunks.push(chunk);
                });
                readStream.on('end', function () {
                    var logString = Buffer.concat(chunks).toString('utf8');
                    if (fileId === 'metaInfo') {  // Deprecated
                        // debug('The `metaInfo` parameter is deprecated, use `getJobStatus` instead');
                        ftpClient.list(jobId, function (err, list) {
                            /* Expected list response
                            JOBNAME  JOBID    OWNER    STATUS CLASS
                            HRECALLW JOB19142 VPADEV   OUTPUT A        RC=0000
                            --------
                                     ID  STEPNAME PROCSTEP C DDNAME   BYTE-COUNT
                                     001 JES2        N/A   H JESMSGLG      1584
                                     002 JES2        N/A   H JESJCL         315
                                     003 JES2        N/A   H JESYSMSG       980
                            3 spool files
                            **/
                            if (err) {
                                return deferred.reject(err);
                            }
                            var headerIndex = list.findIndex(function (line) {
                                return /^\s+ID\s+/i.test(line);
                            });
                            if (headerIndex === -1) {
                                return deferred.reject(new Error('Cannot find job header line'));
                            }
                            var spoolFiles = parseSpoolTable(list.slice(headerIndex));
                            logString.split(/\s*!! END OF JES SPOOL FILE !!\s*/)
                                .filter(function (l) {return l;})
                                .forEach(function (c, i) {
                                    spoolFiles[i].content = c;
                                });
                            deferred.resolve(spoolFiles);
                        });
                    } else {
                        return deferred.resolve(logString);
                    }
                });
                readStream.on('error', function (err) {
                    deferred.reject(err);
                });
                readStream.resume();
            });
        });
    });
    return deferred.promise;
};

/**
 * Purge/delete job by job id.  The following parameters are accepted:
 *
 * @param {string} jobId - Specify JES job ID
 *
 * or
 *
 * @param {object} option - Option which contains
 *    jobId:   specify a JES job ID, which is required
 *    owner:   specify a JES job owner, which is optional and can contain a wildcard (*)
 *
 * @returns {*}
 */
ZosAccessor.prototype.deleteJob = function (jobIdOrOption) {
    var deferred = Q.defer();
    var ftpClient = this.client;

    var option = {};
    if (typeof jobIdOrOption === 'string') {
        option = { jobId: jobIdOrOption, owner: this.username };
    } else if (typeof jobIdOrOption === 'object') {
        option.jobId = option.jobId;
        option.owner = option.owner || this.username;
    } else {
        throw new Error('The first parameter type of deleteJob() should be string or object.')
    }

    if (option.jobId === undefined) {
        throw new Error('The job ID is required by deleteJob().')
    }

    ftpClient.site('FILETYPE=JES JESJOBNAME=*', function (err, responseText, responseCode) {
        if (err) {
            return deferred.reject(err);
        }
        ftpClient.delete(option.jobId, function (err) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve();
            }
        });
    });
    return deferred.promise;
};

/**
 * Submit raw JCL text to JES server
 *
 * @param {string} JCLText - The raw JCL string to be submitted
 */
//TODO: support built-in JCL
ZosAccessor.prototype.submitJCL = function(JCLText) {
    var deferred = Q.defer();
    var ftpClient = this.client;
    if (typeof JCLText === 'string') {
        // FTP server requires ascii text ends with \r\n
        JCLText = JCLText.replace(/\r?\n/g, '\r\n');
    }
    var self = this;
    ftpClient.ascii(function (err) {
        if (err) {
            return deferred.reject(err);
        }
        ftpClient.site('FILETYPE=JES', function (err, responseText, responseCode) {
            if (err) {
                return deferred.reject(err);
            }
            ftpClient.put(Buffer.from(JCLText), 'PLACEHOL', function (err) {
                if (err) {
                    deferred.reject(err);
                } else {
                    var matched = arguments.callee.caller.arguments[1].match(/JES as (\w+)\s/i);
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
};

/**
 * Submits SITE commands.
 * 
 * @param siteCommands site commands separated with space
 * @returns what's returned from server
 */
ZosAccessor.prototype.site = function(siteCommands) {
    const deferred = Q.defer();
    var ftpClient = this.client;
    ftpClient.site(siteCommands, function(err, text) {
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
ZosAccessor.prototype.stat = function(option) {
    const command = option ? `stat (${option}` : 'stat'; 
    return this.send(command);
}

/**
 * Sends any command that FTP can understand with SEND.
 * 
 * @param command command to send
 * @returns what's returned from server
 */
ZosAccessor.prototype.send = function(command) {
    const deferred = Q.defer();
    var ftpClient = this.client;
    ftpClient._send(command, (err, text) => {
        if (err) {
            deferred.reject(err);
            return;
        }
        deferred.resolve(text);
    })
    return deferred.promise;
}


function isFullQualifiedDSN(dsn) {
    return dsn[0] === "'" && dsn[dsn.length-1] === "'";
}

function ensureFullQualifiedDSN(dsn) {
    if(dsn.indexOf('/') !== 0 && !isFullQualifiedDSN(dsn)) {
        dsn = "'" + dsn + "'";
    }
    return dsn;
}

function stripQuotes(dsn) {
    if (isFullQualifiedDSN(dsn)) {
        return dsn.substring(1, dsn.length - 1);
    }
    return dsn;
}

/**
 * Parse the header line for the individual headers and their position. For example:
 * 
 * <pre>
 * ' Name      Size     TTR   Alias-of AC'
 * </pre>
 * 
 * It splits headerLine by spaces, and outputs positions as follows;
 * 
 * <pre>
 *   [{
 *     header: 'Name';
 *     start: 1;
 *     end: 5;
 *   }, ...]
 * </pre>
 *
 * @param headerLine input header line
 * @param base adjust the base position for start/end
 * @returns position array
 */
 function parseHeader(headerLine, base = 0) {
    var headers = headerLine.split(/\s+/);
    var positions = [];
    var lastPosition = 0;
    headers.forEach(function(header) {
        // No header is substring of another header.
        var position = { 
            header: header,
            start: base + headerLine.indexOf(header),
            end: base + headerLine.indexOf(header) + header.length
        };
        positions.push(position);
        lastPosition = position.end;
    });
    return positions;
}

/**
 * Parses the field line based the information from position. For example:
 * 
 * <pre>
 * ' Name      Size     TTR   Alias-of AC ',
 * 'DD        03DBD8   031506 IRRENV00 01 '
 * </pre>
 * 
 * To parse the first field of 'Name'. It locates the field with header position, which is 'D    '.
 * Then it searches for ' ' backwards and forwards to determine the actual field string, which is 'DD    '.
 * Finally returns the trimmed string of 'DD'.
 * 
 * Take 'Size' as another example, The field located with header position is '3DBD', which is directly
 * under 'Size'. Then it searches for ' ' backwards/forwards and gets '03DBD8'.
 * 
 * Note: It would not work if no ' ' between two fields, which is handled in `parseDataSets()`
 * 
 * @param line field line to parse
 * @param position position of header
 * @returns the trimmed field string
 */
function parseField(line, position) {
    var start = position.start;
    while (start >= 0) {
        if (line[start] === ' ') {
            break;
        }
        start --;
    }
    var end = position.end;
    while (end < line.length) {
        if (line[end] === ' ') {
            break;
        }
        end ++;
    }
    return line.substring(start, end).trim();
}
