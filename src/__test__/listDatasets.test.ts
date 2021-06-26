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

import { DatasetEntry } from '../interfaces/DatasetEntry';
import { DatasetMemberEntry } from '../interfaces/DatasetMemberEntry';
import { TransferMode, ZosAccessor } from '../zosAccessor';
import {
    connectFTPServer,
    deleteDataset,
    DSNAME_LOADLIB,
    getDatasetName,
    getDatasetNameWithMember,
    getRandomDatasetName,
    getRandomString } from './testUtils';

let dsn1: string;
let dsn2: string;

let pds: string;
let member1: string;
let member2: string;

describe('The method of listDatasets()', () => {

    jest.setTimeout(60000);
    let accessor: ZosAccessor;

    beforeEach(async () => {
        accessor = await connectFTPServer();

        dsn1 = getRandomDatasetName();
        dsn2 = getRandomDatasetName();
        pds = getRandomDatasetName();
        member1 = getRandomString(8);
        member2 = getRandomString(8);
    });

    afterEach(async () => {
        if (accessor) {
            await deleteDataset(accessor, dsn1);
            await deleteDataset(accessor, dsn2);
            await deleteDataset(accessor, pds);
            await accessor.close();
        }
    });

    it('can list datasets with HLQ.NODEACC.*', async () => {
        await accessor.allocateDataset(dsn1);
        await accessor.allocateDataset(dsn2);

        const list = await accessor.listDatasets(getDatasetName('*'));
        const dsn1Entry = list.find((entry) => {
            const datasetEntry = entry as DatasetEntry;
            return `'${datasetEntry.name}'` === dsn1;
        });
        const dsn2Entry = list.find((entry) => {
            const datasetEntry = entry as DatasetEntry;
            return `'${datasetEntry.name}'` === dsn2;
        });
        expect(dsn1Entry).toBeDefined();
        expect(dsn2Entry).toBeDefined();
    });

    it('can list dataset with DSN', async () => {
        await accessor.allocateDataset(dsn1);

        const list = await accessor.listDatasets(dsn1);
        const dsn1Entry = list.find((entry) => {
            const datasetEntry = entry as DatasetEntry;
            return `'${datasetEntry.name}'` === dsn1;
        });
        expect(dsn1Entry).toBeDefined();
    });

    it('can list nothing if dataset does not exist', async () => {
        const list = await accessor.listDatasets('NOT.EXIST');
        expect(list.length).toBe(0);
    });

    it('can list members of PDS dataset', async () => {
        const pdsMember1 = getDatasetNameWithMember(pds, member1);
        const pdsMember2 = getDatasetNameWithMember(pds, member2);

        await accessor.allocateDataset(pds, 'DSORG=PO DIRECTORY=20 LRECL=80 RECFM=FB BLKsize=800');
        await accessor.uploadDataset('hello member1', pdsMember1, TransferMode.ASCII);
        await accessor.uploadDataset('hello member2', pdsMember2, TransferMode.ASCII);

        const list: DatasetMemberEntry[] = await accessor.listMembers(pds);
        const dsn1Entry = list.find((entry) => {
            const datasetEntry = entry;
            return datasetEntry.name === member1;
        }) as DatasetMemberEntry;
        const dsn2Entry = list.find((entry) => {
            const datasetEntry = entry;
            return datasetEntry.name === member2;
        });
        expect(dsn1Entry).toBeDefined();
        expect(dsn2Entry).toBeDefined();

        expect(dsn1Entry.name).toBe(member1);
        expect(dsn1Entry.size).toBe(1);
        expect(dsn1Entry.created).toBeDefined();
        expect(dsn1Entry.rawString).toBeDefined();
        expect(dsn1Entry.fieldNames).toBeDefined();
        expect(dsn1Entry.version).toBeDefined();
    });

    it('can list nothing if PDS dataset does not exist', async () => {
        try {
            expect.assertions(1);
            await accessor.listMembers('NOT.EXIST');
        } catch (err) {
            expect(err.message).toBe(`Partitioned data set 'NOT.EXIST(*)' does not exist`);
        }
    });

    it('can list members of PDS LoadLib dataset', async () => {
        const list: DatasetMemberEntry[] = await accessor.listMembers(DSNAME_LOADLIB);
        expect(list.length).toBeGreaterThan(0);
        expect(list[0].name).toBeDefined(); 
        expect(list[0].ac === 0 || list[0].ac === 1).toBeTruthy();
        expect(list[0].amode === '24' || list[0].amode === '31' || list[0].amode === 'ANY').toBeTruthy();
        expect(list[0].rmode === '24' || list[0].rmode === '31' || list[0].rmode === 'ANY').toBeTruthy();
    });    
});
