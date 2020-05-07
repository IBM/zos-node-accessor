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
import { connectFTPServer, deleteDirectory, getNameFromUSSPath, getRandomUSSPath } from './testUtils';

let baseDir = '';

describe('The method of renameFile()', () => {
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

    it('can rename a directory', async () => {
        const ussPath1 = getRandomUSSPath(baseDir);
        const ussPath2 = getRandomUSSPath(baseDir);
        await accessor.makeDirectory(ussPath1);
        await accessor.renameFile(ussPath1, ussPath2);
        const list = await accessor.listFiles(baseDir);
        expect(list.find((entry) => entry.name === getNameFromUSSPath(ussPath1))).toBeUndefined();
        expect(list.find((entry) => entry.name === getNameFromUSSPath(ussPath2))).toBeDefined();
    });

    it('can rename a USS file', async () => {
        const filePath1 = getRandomUSSPath(baseDir);
        const filePath2 = getRandomUSSPath(baseDir);
        await accessor.uploadFile('hello', filePath1);
        await accessor.renameFile(filePath1, filePath2);
        const list = await accessor.listFiles(baseDir);
        expect(list.find((entry) => entry.name === getNameFromUSSPath(filePath1))).toBeUndefined();
        expect(list.find((entry) => entry.name === getNameFromUSSPath(filePath2))).toBeDefined();
    });

});
