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

import { ZosAccessor } from '../zosAccessor';
import { connectFTPServer, getRandomDatasetName, deleteDataset } from './testUtils';
import { Utils } from '../utils';
import { DatasetEntry } from '../interfaces/DatasetEntry';

let dsn: string;

describe('The method of allocateDataset()', () => {

    jest.setTimeout(60000);
    let accessor: ZosAccessor;

    beforeEach(async () => {
        accessor = await connectFTPServer();
        dsn = getRandomDatasetName();
    });

    afterEach(async() => {
        if (accessor) {
            await deleteDataset(accessor, dsn);
            await accessor.close();
        }
    });

    it('can allocate PS dataset', async () => {
        await accessor.allocateDataset(dsn);
        const contents = await accessor.downloadDataset(dsn);
        expect(contents.toString().trim()).toBe('');
    });

    it('can allocate PS dataset \'LRECL=80 RECFM=F BLKsize=800\'', async () => {
        await accessor.allocateDataset(dsn, 'LRECL=80 RECFM=F BLKsize=800');
        const entries = await accessor.listDatasets(dsn);
        expect(entries.length).toBe(1);
        const entry: DatasetEntry = entries[0] as DatasetEntry;
        expect(entry.name).toBe(Utils.removeQuote(dsn));
        expect(entry.dsOrg).toBe('PS');
        expect(entry.recordFormat).toBe('F');
        expect(entry.recordLength).toBe(80);
        expect(entry.blockSize).toBe(80);
    });

    it('can allocate PS dataset with \'LRECL=80 RECFM=FB BLKsize=800\'', async () => {
        await accessor.allocateDataset(dsn, 'LRECL=80 RECFM=FB BLKsize=800');
        const entries = await accessor.listDatasets(dsn);
        expect(entries.length).toBe(1);
        const entry: DatasetEntry = entries[0] as DatasetEntry;
        expect(entry.name).toBe(Utils.removeQuote(dsn));
        expect(entry.dsOrg).toBe('PS');
        expect(entry.recordFormat).toBe('FB');
        expect(entry.recordLength).toBe(80);
        expect(entry.blockSize).toBe(800);
    });

    it('can allocate PS dataset with \'LRECL=80 RECFM=VB BLKsize=800\'', async () => {
        await accessor.allocateDataset(dsn, 'LRECL=80 RECFM=VB BLKsize=800');
        const entries = await accessor.listDatasets(dsn);
        expect(entries.length).toBe(1);
        const entry: DatasetEntry = entries[0] as DatasetEntry;
        expect(entry.name).toBe(Utils.removeQuote(dsn));
        expect(entry.dsOrg).toBe('PS');
        expect(entry.recordFormat).toBe('VB');
        expect(entry.recordLength).toBe(80);
        expect(entry.blockSize).toBe(800);
    });

    it('can allocate PDS dataset \'DSORG=PO LRECL=80 RECFM=FB BLKsize=800\'', async () => {
        await accessor.allocateDataset(dsn, 'DSORG=PO DIRECTORY=20 LRECL=80 RECFM=FB BLKsize=800');
        const entries = await accessor.listDatasets(dsn);
        expect(entries.length).toBe(1);
        const entry: DatasetEntry = entries[0] as DatasetEntry;
        expect(entry.name).toBe(Utils.removeQuote(dsn));
        expect(entry.dsOrg).toBe('PO');
        expect(entry.recordFormat).toBe('FB');
        expect(entry.recordLength).toBe(80);
        expect(entry.blockSize).toBe(800);
    });

    it('can allocate PDS dataset \'PDSTYPE=PDS LRECL=80 RECFM=FB BLKsize=800\'', async () => {
        await accessor.allocateDataset(dsn, 'PDSTYPE=PDS DIRECTORY=20 LRECL=80 RECFM=FB BLKsize=800');
        const entries = await accessor.listDatasets(dsn);
        expect(entries.length).toBe(1);
        const entry: DatasetEntry = entries[0] as DatasetEntry;
        expect(entry.name).toBe(Utils.removeQuote(dsn));
        expect(entry.dsOrg).toBe('PO');
        expect(entry.recordFormat).toBe('FB');
        expect(entry.recordLength).toBe(80);
        expect(entry.blockSize).toBe(800);
    });
});
