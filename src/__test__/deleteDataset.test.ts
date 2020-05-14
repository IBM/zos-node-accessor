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
import { connectFTPServer, getRandomDatasetName, deleteDataset, getDatasetNameWithMember, getRandomString } from './testUtils';
import Q from 'q';

let dsn: string;
let dsnStem: string;
let dsn1: string;
let dsn2: string;

describe('The method of deleteDataset()', () => {

    jest.setTimeout(120000);
    let accessor: ZosAccessor;

    beforeEach(async () => {
        accessor = await connectFTPServer();
        dsn = getRandomDatasetName();
        dsnStem = getRandomDatasetName(7, false);
        dsn1 = dsnStem + '1';
        dsn2 = dsnStem + '2';
    });

    afterEach(async() => {
        if (accessor) {
            await deleteDataset(accessor, dsn);
            await deleteDataset(accessor, dsn1);
            await deleteDataset(accessor, dsn2);
            await accessor.close();
        }
    });

    async function findDataset(name: string) {
        const list = await accessor.listDatasets(name);
        const found = list.find((entry) => {
            const datasetEntry = entry;
            return datasetEntry.name === name || `'${datasetEntry.name}'` === name;
        });
        return Q.resolve(found);
    }

    async function findDatasetMember(name: string, member: string) {
        const list = await accessor.listMembers(name);
        const found = list.find((entry) => {
            const datasetEntry = entry;
            return datasetEntry.name === member;
        });
        return Q.resolve(found);
    }

    it('can delete PS dataset', async () => {
        await accessor.allocateDataset(dsn);
        expect(await findDataset(dsn)).toBeDefined();

        await accessor.deleteDataset(dsn);
        expect(await findDataset(dsn)).toBeUndefined();
    });

    // It's not supported now.
    xit('can delete multiple PS dataset with *', async () => {
        await accessor.allocateDataset(dsn1);
        await accessor.allocateDataset(dsn2);
        expect(await findDataset(dsn1)).toBeDefined();
        expect(await findDataset(dsn2)).toBeDefined();

        await accessor.deleteDataset(dsnStem + '*');
        expect(await findDataset(dsn1)).toBeUndefined();
        expect(await findDataset(dsn2)).toBeUndefined();
    });

    it('can delete PDS dataset', async () => {
        await accessor.allocateDataset(dsn, 'DSORG=PO DIRECTORY=20 LRECL=80 RECFM=FB BLKsize=800');
        expect(await findDataset(dsn)).toBeDefined();

        const member = getRandomString(8);
        await accessor.uploadDataset('hello', getDatasetNameWithMember(dsn, member));
        expect(await findDatasetMember(dsn, member)).toBeDefined();

        await accessor.deleteDataset(dsn);
        expect(await findDataset(dsn)).toBeUndefined();
    });

    it('can delete PDS dataset member', async () => {
        await accessor.allocateDataset(dsn, 'DSORG=PO DIRECTORY=20 LRECL=80 RECFM=FB BLKsize=800');
        expect(await findDataset(dsn)).toBeDefined();

        const member = getRandomString(8);
        await accessor.uploadDataset('hello', getDatasetNameWithMember(dsn, member));
        expect(await findDatasetMember(dsn, member)).toBeDefined();

        await accessor.deleteDataset(getDatasetNameWithMember(dsn, member));
        expect(await findDatasetMember(dsn, member)).toBeUndefined();
    });
});
