/****************************************************************************/
/*                                                                          */
/* Copyright (c) 2017, 2020 IBM Corp.                                       */
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

import { TransferMode, ZosAccessor } from '../zosAccessor';
import { connectFTPServer, deleteDataset, getRandomDatasetName,
    getStreamContents, getStreamContentsWithPipe } from './testUtils';
import path from 'path';

let dsn: string;
let pds: string;

let settingsFilePath = '/build/zos-node-accessor/customSettings.json'; // For running on Jenkins server
if (!fs.existsSync(settingsFilePath)) {
    settingsFilePath = path.join(__dirname, '../../resources/customSettings.json');
    if (!fs.existsSync(settingsFilePath)) {
        throw new Error(`The settings file, ${settingsFilePath}, is not found.`);
    }
}

const settings = JSON.parse(fs.readFileSync(settingsFilePath).toString());
export const dsname_rdw = settings.dsname_rdw;
export const dssize_rdw = settings.dssize_rdw;

describe('The method of downloadDataset()', () => {

    jest.setTimeout(60000);
    let accessor: ZosAccessor;

    beforeEach(async () => {
        accessor = await connectFTPServer();
        dsn = getRandomDatasetName();
        pds = getRandomDatasetName();
    });

    afterEach(async () => {
        if (accessor) {
            await deleteDataset(accessor, dsn);
            await deleteDataset(accessor, pds);
            await accessor.close();
        }
    });

    async function reconnectFTPServer() {
        if (accessor) {
            await accessor.close();
        }
        accessor = await connectFTPServer();
    }

    it('can get text contents from dataset with the default TransferMode.ASCII', async () => {
        await accessor.uploadDataset('hello\nworld', dsn);
        const contents1 = await accessor.downloadDataset(dsn, TransferMode.ASCII);
        expect(contents1.toString().trim()).toBe('hello\nworld');
        await reconnectFTPServer()
        const contents2 = await accessor.downloadDataset(dsn, TransferMode.ASCII);
        expect(contents2.toString().trim()).toBe('hello\nworld');
    });

    it('can get text contents as stream from dataset with the default TransferMode.ASCII', async () => {
        await accessor.uploadDataset('hello\nworld', dsn);
        const readSteam = await accessor.downloadDataset(dsn, TransferMode.ASCII, true) as fs.ReadStream;
        const buffer = await getStreamContents(readSteam);
        expect(buffer.toString().trim()).toBe('hello\nworld');
    });

    it('can get text contents as stream pipe from dataset with the default TransferMode.ASCII', async () => {
        await accessor.uploadDataset('hello\nworld', dsn);
        const readSteam = await accessor.downloadDataset(dsn, TransferMode.ASCII, true) as fs.ReadStream;
        const buffer = await getStreamContentsWithPipe(readSteam);
        expect(buffer.toString().trim()).toBe('hello\nworld');
    });

    it('can get text contents from dataset with TransferMode.ASCII_STRIP_EOL', async () => {
        await accessor.uploadDataset('hello\r\nworld', dsn);
        const contents1 = await accessor.downloadDataset(dsn, TransferMode.ASCII);
        expect(contents1.toString().trim()).toBe('hello\r\nworld');
        await reconnectFTPServer()
        const contents2 = await accessor.downloadDataset(dsn, TransferMode.ASCII_STRIP_EOL);
        expect(contents2.toString().trim()).toBe('helloworld');
    });

    it('can get text contents from dataset with TransferMode.ASCII_NO_TRAILING_BLANKS', async () => {
        await accessor.uploadDataset('hello       ', dsn, TransferMode.ASCII, { RECfm: 'FB', LRECL: 80 });
        const contents1 = await accessor.downloadDataset(dsn, TransferMode.ASCII);
        expect(contents1.toString()).toBe('hello                                                                           \r\n');
        await reconnectFTPServer()
        const contents2 = await accessor.downloadDataset(dsn, TransferMode.ASCII_NO_TRAILING_BLANKS);
        expect(contents2.toString()).toBe('hello\r\n');
    });

    it('can get text contents from dataset with TransferMode.BINARY', async () => {
        await accessor.uploadDataset('hello\r\nworld', dsn);
        const contents2 = await accessor.downloadDataset(dsn, TransferMode.BINARY);
        expect(contents2.toString('hex').trim()).toBe('8885939396a696999384');
    });

    it('can download variable length dataset with TransferMode.BINARY_RDW', async () => {
        const contents2 = await accessor.downloadDataset(dsname_rdw, TransferMode.BINARY_RDW);
        fs.writeFileSync('./file', contents2);
        const stats = fs.statSync('./file')
        const fileSizeInBytes = stats.size
        expect(fileSizeInBytes).toEqual(dssize_rdw);
    });
});
