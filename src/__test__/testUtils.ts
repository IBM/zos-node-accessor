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

import * as fs from 'fs';
import * as path from 'path';
import Q from 'q';

import { Writable, WritableOptions } from 'stream';
import { JobIdOption } from '../interfaces/JobIdOption';
import { Utils } from '../utils';
import { FileToOperate, ZosAccessor } from '../zosAccessor';

export interface JobNameAndJCL {
    jobName: string;
    jcl: string;
}

let settingsFilePath = '/build/zos-node-accessor/customSettings.json'; // For running on Jenkins server
if (!fs.existsSync(settingsFilePath)) {
    settingsFilePath = path.join(__dirname, '../../resources/customSettings.json');
    if (!fs.existsSync(settingsFilePath)) {
        throw new Error(`The settings file, ${settingsFilePath}, is not found.`);
    }
}

const settings = JSON.parse(fs.readFileSync(settingsFilePath).toString());
export const USERNAME = settings.username.toUpperCase();
const PASSWD = settings.password;
const HOST = settings.host;
const PORT = settings.port;
export const DSNAME_LOADLIB = settings.dsname_loadlib;

export async function connectFTPServer() {

    const client = new ZosAccessor();
    const option = { user: USERNAME, password: PASSWD, host: HOST, port: PORT, connTimeout: 10000, pasvTimeout: 10000 };
    await client.connect(option);
    if (!client.isConnected()) {
        // tslint:disable-next-line: no-console
        console.error('Failed to connect to', HOST);
    }
    return client;
}

export async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function deleteDataset(client: ZosAccessor, dsn: string) {
    try {
        await client.deleteDataset(dsn);
    } catch (err) {
        // Ignore;
    }
}

export async function deleteDirectory(client: ZosAccessor, dir: string) {
    try {
        await client.deleteFile(dir, FileToOperate.WHOLE_DIRECTORY);
    } catch (err) {
        // Ignore;
    }
}

export function getHelloJcl(): JobNameAndJCL {
    let jcl = fs.readFileSync(path.join(__dirname, '../JCL/HELLO.jcl'), 'utf8');
    jcl = jcl.replace('__MSGCLASS__', 'H');
    return { jobName: 'HELLO', jcl };
}

export async function submitHelloJob(client: ZosAccessor) {
    const { jobName, jcl } = getHelloJcl();
    const jobId = await client.submitJCL(jcl);
    const queryStatus: JobIdOption = { jobId };
    let status = await client.getJobStatus(queryStatus);
    while (status.rc !== 0) {
        status = await client.getJobStatus(queryStatus);
        await sleep(5000);
    }
    return { status, jobId, jobName };
}

export function getRandomString(length: number, variable: boolean = false): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    if (variable) {
        length = Math.floor(Math.random() * length) + 1;
    }
    for (let i = 0; i < length; i++) {
        const range = i === 0 ? 26 : characters.length;
        result += characters.charAt(Math.floor(Math.random() * range));
    }
    return result;
}

export function getUSSPath(name: string): string {
    return `/u/${USERNAME.toLowerCase()}/${name}`;
}

export function getUSSPathRoot(): string {
    return `/u/${USERNAME.toLowerCase()}/nodeacc/`;
}

export function getRandomUSSPath(dir?: string): string {
    if (dir) {
        return `${dir}/${getRandomString(16, true)}`;
    }
    return `/u/${USERNAME.toLowerCase()}/nodeacc/${getRandomString(16)}`;
}

export function getNameFromUSSPath(ussPath: string): string {
    const posn = ussPath.lastIndexOf('/');
    if (posn !== -1) {
        return ussPath.substring(posn + 1);
    }
    return ussPath;
}

export function getDatasetName(name: string, withQuotes: boolean = true): string {
    const dsn = `${USERNAME.toUpperCase()}.NODEACC.${name}`;
    return withQuotes ? `'${dsn}'` : dsn;
}

export function getRandomDatasetName(length: number = 8, withQuotes: boolean = true): string {
    return getDatasetName(getRandomString(length), withQuotes);
}

export function getRandomDatasetNameWithMember(pds: string): string {
    return `'${Utils.removeQuote(pds)}(${getRandomString(8)})'`;
}

export function getDatasetNameWithMember(pds: string, member: string): string {
    return `'${Utils.removeQuote(pds)}(${member})'`;
}

export async function getStreamContents(stream: fs.ReadStream) {
    const deferred = Q.defer<Buffer>();
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
    });
    stream.on('end', () => {
        const buffer: Buffer = Buffer.concat(chunks);
        deferred.resolve(buffer);
    });
    stream.on('error', (err) => {
        deferred.reject(err);
    });
    stream.resume();
    return deferred.promise;
}

export async function getStreamContentsWithPipe(readSteam: fs.ReadStream) {
    const deferred = Q.defer<Buffer>();
    const writeStream = new BufferStream();
    readSteam.pipe(writeStream);
    writeStream.on('error', (err) => {
        deferred.reject(err);
    });
    writeStream.on('finish', () => {
        deferred.resolve(writeStream.buffer);
    });
    return deferred.promise;
}

export class BufferStream extends Writable {

    private buffers: Buffer[] = [];

    public buffer: Buffer = new Buffer('');

    constructor(options?: WritableOptions) {
        super(options);
    }

    public _write(chunk: Buffer, encoding: string, callback: (error?: Error | null) => void) {
        this.buffers.push(chunk);
        callback();
    }

    public _final(callback: (error?: Error | null) => void) {
        this.buffer = Buffer.concat(this.buffers);
        callback();
    }
}
