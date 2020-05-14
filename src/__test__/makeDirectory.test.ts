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
import { connectFTPServer, getRandomUSSPath, getNameFromUSSPath, deleteDirectory } from './testUtils';

let baseDir = '';

describe('The method of makeDirectory()', () => {
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

    // Can create a USS directory
    it('can create a USS directory', async () => {
        const ussPath = getRandomUSSPath(baseDir);
        await accessor.makeDirectory(ussPath)

        const list = await accessor.listFiles(baseDir)
        expect(list.find((entry) => entry.name === getNameFromUSSPath(ussPath))).not.toBeUndefined();
    });

});
