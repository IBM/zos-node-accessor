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
import * as path from 'path';

import { TransferMode, ZosAccessor } from '../zosAccessor';
import { connectFTPServer, deleteDataset, getRandomDatasetName, getRandomDatasetNameWithMember } from './testUtils';

let dsn: string;
let pds: string;

describe('The method of uploadDataset()', () => {

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

    it('can upload PS dataset', async () => {
        await accessor.uploadDataset('hello\nworld', dsn);
        const contents = await accessor.downloadDataset(dsn);
        expect(contents.toString().trim()).toBe('hello\nworld');
    });

    it('can upload three-row text to PS dataset with (LRECL=80 RECFM=F BLKsize=800)', async () => {
        const fileContents = fs.readFileSync(path.join(__dirname, 'files/three-rows.txt'));
        await accessor.uploadDataset(fileContents, dsn, TransferMode.ASCII, 'LRECL=80 RECFM=F BLKsize=800');
        const contents = await accessor.downloadDataset(dsn);
        expect(contents.toString().trim()).toBe(fileContents.toString());
    });

    it('can upload long-row text truncted to PS dataset with (LRECL=80 RECFM=F BLKsize=800)', async () => {
        const fileContents = fs.readFileSync(path.join(__dirname, 'files/long-rows.txt'))
            .toString().split('\n').join('\r\n');
        await accessor.uploadDataset(fileContents, dsn, TransferMode.ASCII, 'LRECL=80 RECFM=F BLKsize=800');
        const contents = await accessor.downloadDataset(dsn);

        // Only the first line is uploaded.
        const expected = fileContents.toString().split('\n').map((line) => {
            return line.substring(0, 80);
        }).join('\r\n') + '\r\n';                           // Every line has EOL (\r\n) appeneded.
        expect(contents.toString()).toBe(expected);
    });

    it('can upload long-row text to PS dataset with (LRECL=80 RECFM=F BLKsize=800)', async () => {
        const fileContents = fs.readFileSync(path.join(__dirname, 'files/long-rows.txt'))
            .toString().split('\n').map((line) => {
                return line.substring(0, 60);
            }).join('\r\n');
        await accessor.uploadDataset(fileContents, dsn, TransferMode.ASCII, 'LRECL=80 RECFM=F BLKsize=800');
        const contents = await accessor.downloadDataset(dsn);

        const expected = fileContents.toString().split('\n').map((line) => {
            return line.trim() + '                    ';    // Append 20 space characters.
        }).join('\r\n') + '\r\n';                           // Every line has EOL (\r\n) appeneded.
        expect(contents.toString()).toBe(expected);
    });

    it('can upload one record binary to PS dataset with (LRECL=80 RECFM=F BLKsize=800)', async () => {
        const fileContents = fs.readFileSync(path.join(__dirname, 'files/three-rows.txt'));
        await accessor.uploadDataset(fileContents, dsn, TransferMode.BINARY, 'LRECL=80 RECFM=F BLKsize=800');
        const contents = await accessor.downloadDataset(dsn, TransferMode.BINARY);
        const expected = Buffer.alloc(80, 0)
        fileContents.copy(expected, 0);
        expect(contents).toStrictEqual(expected);
    });

    it('can upload multiple records binary to PS dataset with (LRECL=80 RECFM=F BLKsize=800)', async () => {
        const fileContents = fs.readFileSync(path.join(__dirname, 'files/long-rows.txt'));
        await accessor.uploadDataset(fileContents, dsn, TransferMode.BINARY, 'LRECL=80 RECFM=F BLKsize=800');
        const contents = await accessor.downloadDataset(dsn, TransferMode.BINARY);
        const records = Math.ceil(fileContents.length / 80);
        const expected = Buffer.alloc(records * 80, 0);
        fileContents.copy(expected, 0);
        expect(contents).toStrictEqual(expected);
    });

    it('can upload multiple records binary to PDS dataset member with (LRECL=80 RECFM=F BLKsize=800)', async () => {
        const pdsMember = getRandomDatasetNameWithMember(pds);
        const fileContents = fs.readFileSync(path.join(__dirname, 'files/long-rows.txt'));
        await accessor.allocateDataset(pds, 'DSORG=PO DIRECTORY=20 LRECL=80 RECFM=FB BLKsize=800');
        await accessor.uploadDataset(fileContents, pdsMember, TransferMode.BINARY, 'LRECL=80 RECFM=F BLKsize=800');
        const contents = await accessor.downloadDataset(pdsMember, TransferMode.BINARY);
        const records = Math.ceil(fileContents.length / 80);
        const expected = Buffer.alloc(records * 80, 0);
        fileContents.copy(expected, 0);
        expect(contents).toStrictEqual(expected);
    });
});
