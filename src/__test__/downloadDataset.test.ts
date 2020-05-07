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

let dsn: string;
let pds: string;

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

    it('can get text contents from dataset with the default FileTransferType.ASCII', async () => {
        await accessor.uploadDataset('hello\nworld', dsn);
        const contents1 = await accessor.downloadDataset(dsn, TransferMode.ASCII);
        expect(contents1.toString().trim()).toBe('hello\nworld');
        const contents2 = await accessor.downloadDataset(dsn, TransferMode.ASCII);
        expect(contents2.toString().trim()).toBe('hello\nworld');
    });

    it('can get text contents as stream from dataset with the default FileTransferType.ASCII', async () => {
        await accessor.uploadDataset('hello\nworld', dsn);
        const readSteam = await accessor.downloadDataset(dsn, TransferMode.ASCII, true) as fs.ReadStream;
        const buffer = await getStreamContents(readSteam);
        expect(buffer.toString().trim()).toBe('hello\nworld');
    });

    it('can get text contents as stream pipe from dataset with the default FileTransferType.ASCII', async () => {
        await accessor.uploadDataset('hello\nworld', dsn);
        const readSteam = await accessor.downloadDataset(dsn, TransferMode.ASCII, true) as fs.ReadStream;
        const buffer = await getStreamContentsWithPipe(readSteam);
        expect(buffer.toString().trim()).toBe('hello\nworld');
    });

    it('can get text contents from dataset with FileTransferType.ASCII_STRIP_EOL', async () => {
        await accessor.uploadDataset('hello\r\nworld', dsn);
        const contents1 = await accessor.downloadDataset(dsn, TransferMode.ASCII);
        expect(contents1.toString().trim()).toBe('hello\r\nworld');
        const contents2 = await accessor.downloadDataset(dsn, TransferMode.ASCII_STRIP_EOL);
        expect(contents2.toString().trim()).toBe('helloworld');
    });

    it('can get text contents from dataset with FileTransferType.BINARY', async () => {
        await accessor.uploadDataset('hello\r\nworld', dsn);
        const contents2 = await accessor.downloadDataset(dsn, TransferMode.BINARY);
        expect(contents2.toString('hex').trim()).toBe('8885939396a696999384');
    });

});
