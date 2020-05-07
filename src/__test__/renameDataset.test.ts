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


import { ZosAccessor, TransferMode } from '../zosAccessor';
import { connectFTPServer, getRandomDatasetName, deleteDataset, getDatasetNameWithMember, getRandomString } from './testUtils';

let dsn1: string;
let dsn2: string
let pds: string;

describe('The method of renameDataset()', () => {
    jest.setTimeout(60000);
    let accessor: ZosAccessor;

    beforeEach(async () => {
        accessor = await connectFTPServer();
        dsn1 = getRandomDatasetName();
        dsn2 = getRandomDatasetName();
        pds = getRandomDatasetName();
    });

    afterEach(async () => {
        if (accessor) {
            await deleteDataset(accessor, dsn1);
            await deleteDataset(accessor, dsn2);
            await deleteDataset(accessor, pds);
            await accessor.close();
        }
    });

    it('can rename the dataset correctly', async () => {
        await accessor.allocateDataset(dsn1);
        await accessor.renameDataset(dsn1, dsn2);
        let list = await accessor.listDatasets(dsn2);
        expect(list.find((entry) => entry.name === dsn1)).toBeUndefined();
        list = await accessor.listDatasets(dsn2);
        expect(list.find((entry) => entry.name === dsn2)).toBeUndefined();
    });

    it('can rename the member in partition dataset correctly', async () => {
        const member1 = getRandomString(8);
        const member2 = getRandomString(8);
        const pdsMember1 = getDatasetNameWithMember(pds, member1);
        const pdsMember2 = getDatasetNameWithMember(pds, member2);

        await accessor.allocateDataset(pds, 'DSORG=PO DIRECTORY=20 LRECL=80 RECFM=FB BLKsize=800');
        await accessor.uploadDataset('hello member1', pdsMember1, TransferMode.ASCII);
        await accessor.renameDataset(pdsMember1, pdsMember2);

        const list = await accessor.listMembers(pds);
        const dsn1Entry = list.find((entry) => {
            const datasetEntry = entry;
            return datasetEntry.name === member1;
        });
        const dsn2Entry = list.find((entry) => {
            const datasetEntry = entry;
            return datasetEntry.name === member2;
        });
        expect(dsn1Entry).toBeUndefined();
        expect(dsn2Entry).toBeDefined();
    });

});
