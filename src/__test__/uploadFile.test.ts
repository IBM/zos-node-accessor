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

import { TransferMode, ZosAccessor } from '../zosAccessor';
import { connectFTPServer, deleteDirectory, getNameFromUSSPath, getRandomUSSPath } from './testUtils';

let baseDir = '';

describe('The method of uploadFile()', () => {
    jest.setTimeout(60000);
    let accessor: ZosAccessor;

    beforeEach(async () => {
        accessor = await connectFTPServer();
        baseDir = getRandomUSSPath();
        await accessor.makeDirectory(baseDir);
    });

    afterEach(async () => {
        if (accessor) {
            await deleteDirectory(accessor, baseDir);
            await accessor.close();
        }
    });

    it('can upload a USS file in ascii', async () => {
        const filePath = getRandomUSSPath(baseDir);
        await accessor.uploadFile('hello', filePath, TransferMode.ASCII);
        const list = await accessor.listFiles(baseDir);
        expect(list.find((entry) => entry.name === getNameFromUSSPath(filePath))).toBeDefined();
    });

    it('can upload a USS file in binary', async () => {
        const filePath = getRandomUSSPath(baseDir);
        await accessor.uploadFile('hello', filePath, TransferMode.BINARY);
        const list = await accessor.listFiles(baseDir);
        expect(list.find((entry) => entry.name === getNameFromUSSPath(filePath))).toBeDefined();
    });

});
