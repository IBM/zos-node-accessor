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

import { FileToOperate, ZosAccessor } from '../zosAccessor';
import { connectFTPServer, deleteDirectory, getNameFromUSSPath, getRandomUSSPath, getUSSPathRoot } from './testUtils';

let dir: string;

describe('The method of deleteFile()', () => {
    jest.setTimeout(60000);
    let accessor: ZosAccessor;

    beforeEach(async () => {
        accessor = await connectFTPServer();
        dir = getRandomUSSPath();
        await accessor.makeDirectory(dir);
    });

    afterEach(async () => {
        if (accessor) {
            await deleteDirectory(accessor, dir);
            await accessor.close();
        }
    });

    it('can delete USS file', async () => {
        const filepath = getRandomUSSPath(dir);
        await accessor.uploadFile('hello', filepath);
        let list = await accessor.listFiles(dir);
        expect(list.find((entry) => entry.name === getNameFromUSSPath(filepath))).toBeDefined();

        await accessor.deleteFile(filepath);
        list = await accessor.listFiles(dir);
        expect(list.find((entry) => entry.name === getNameFromUSSPath(filepath))).toBeUndefined();
    });

    /**
     * It is not supported.
     */
    xit('can delete multiple USS files with *', async () => {
        const filepath = getRandomUSSPath(dir);
        const filepath1 = filepath + '1';
        const filepath2 = filepath + '2';
        await accessor.uploadFile('hello', filepath1);
        await accessor.uploadFile('hello', filepath2);
        let list = await accessor.listFiles(dir);
        expect(list.find((entry) => entry.name === getNameFromUSSPath(filepath1))).toBeDefined();
        expect(list.find((entry) => entry.name === getNameFromUSSPath(filepath2))).toBeDefined();

        await accessor.deleteFile(filepath + '*');
        list = await accessor.listFiles(dir);
        expect(list.find((entry) => entry.name === getNameFromUSSPath(filepath1))).toBeUndefined();
        expect(list.find((entry) => entry.name === getNameFromUSSPath(filepath2))).toBeUndefined();
    });

    it('can delete an empty USS directory', async () => {
        const dirpath = getRandomUSSPath(dir);
        await accessor.makeDirectory(dirpath);

        await accessor.deleteFile(dirpath);
        try {
            expect.assertions(1);
            await accessor.listFiles(dirpath);
        } catch (err) {
            expect(err.toString().search('not found')).not.toBe(-1);
        }
    });

    it('can delete the whole USS directory with USSTarget.WHOLE_DIRECTORY', async () => {
        const subdir = getRandomUSSPath(dir);
        await accessor.makeDirectory(subdir);
        const subsubdir = getRandomUSSPath(subdir);
        await accessor.makeDirectory(subsubdir);

        const filepath1 = getRandomUSSPath(subdir);
        const filepath2 = getRandomUSSPath(subsubdir);
        await accessor.uploadFile('hello', filepath1);
        await accessor.uploadFile('hello', filepath2);

        await accessor.deleteFile(subdir, FileToOperate.WHOLE_DIRECTORY);
        try {
            expect.assertions(1);
            await accessor.listFiles(subdir);
        } catch (err) {
            expect(err.toString().search('not found')).not.toBe(-1);
        }
    });

    it('can throw an error when the directory is permission denied', async () => {
        try {
            await accessor.deleteFile(getUSSPathRoot() + '/no_permission'); // File mode: 000
        } catch (err) {
            expect(err.toString().search('Rc = 111')).not.toBe(-1);
        }
    });

    it('can throw an error when the directory not exist', async () => {
        try {
            expect.assertions(1);
            await accessor.deleteFile('/not/exist');
        } catch (err) {
            expect(err.toString().search('not exist')).not.toBe(-1);
        }
    });

    it('can throw an error when the directory is not empty', async () => {
        try {
            const subdir = getRandomUSSPath(dir);
            await accessor.makeDirectory(subdir);

            const filepath1 = getRandomUSSPath(subdir);
            await accessor.uploadFile('hello', filepath1);

            expect.assertions(1);
            await accessor.deleteFile(subdir);
        } catch (err) {
            expect(err.toString().search('is a directory and is not empty')).not.toBe(-1);
        }
    });
});
