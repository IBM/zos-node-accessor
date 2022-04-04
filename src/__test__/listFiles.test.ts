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

import path from 'path';

import { FileType, USSEntry } from '../interfaces/USSEntry';
import { ZosAccessor } from '../zosAccessor';
import {
    connectFTPServer,
    deleteDirectory,
    getNameFromUSSPath,
    getRandomUSSPath,
    getUSSPath,
    getUSSPathRoot,
} from './testUtils';

let baseDir = '';

describe('The method of listFiles()', () => {
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

    it('can list USS files', async () => {
        const ussPath = getRandomUSSPath(baseDir);
        await accessor.uploadDataset('hello', ussPath);

        const list = await accessor.listFiles(baseDir);
        expect(list.find((entry) => entry.name === getNameFromUSSPath(ussPath))).not.toBeUndefined();
    });

    it('can list all USS files and sub-directories, except the hidden ones', async () => {
        const ussPath = getRandomUSSPath(baseDir);
        await accessor.makeDirectory(ussPath);
        const ussPathFile = getRandomUSSPath(ussPath);  // ussPath/file
        await accessor.uploadDataset('hello', ussPathFile);
        const ussPathDir = getRandomUSSPath(ussPath);   // ussPath/dir
        await accessor.makeDirectory(ussPathDir);

        const list: USSEntry[] = await accessor.listFiles(ussPath);
        const file = list.find((entry) => entry.name === getNameFromUSSPath(ussPathFile)) as USSEntry;
        const dir = list.find((entry) => entry.name === getNameFromUSSPath(ussPathDir)) as USSEntry;
        expect(file).toBeDefined();
        expect(dir).toBeDefined();
        expect(file.fileType).toBe(FileType.FILE);
        expect(dir.fileType).toBe(FileType.DIRECTORY);
    });

    // This case requires the following links on USS file system.
    // ```
    // symbolic.txt -> /<uss-path-root>/hello.txt   (file)
    // symbolic     -> /<uss-path-root>/empty       (dir)
    // ```
    it('can list symbol links, except the hidden ones', async () => {
        const list: USSEntry[] = await accessor.listFiles(getUSSPathRoot());
        const file = list.find((entry) => entry.name === 'symbolic.txt') as USSEntry;
        const dir = list.find((entry) => entry.name === 'symbolic') as USSEntry;
        expect(file).toBeDefined();
        expect(dir).toBeDefined();
        expect(file.linkTo).toBe(path.join(getUSSPathRoot(), 'hello.txt'));
        expect(file.fileType).toBe(FileType.LINK);
        expect(dir.linkTo).toBe(path.join(getUSSPathRoot(), 'empty'));
        expect(dir.fileType).toBe(FileType.LINK);
    });

    it('can list empty directory', async () => {
        const ussPath = getRandomUSSPath(baseDir);
        await accessor.makeDirectory(ussPath);

        const list = await accessor.listFiles(ussPath);
        expect(list.length).toBe(0);
    });

    it('can throw an error for permission denied', async () => {
        try {
            await accessor.listFiles(getUSSPathRoot() + '/no_permission_dir'); // File mode: 000
        } catch (err) {
            expect(err.toString().search('EDC5111I Permission denied.')).not.toBe(-1);
        }
    });

    // Throw an error when the directory not found
    it('can throw an error when directory not found', async () => {
        try {
            await accessor.listFiles('/not/exist');
        } catch (err) {
            expect(err.toString().search('not found')).not.toBe(-1);
        }
    });

    it('can list file with invalid character', async () => {
        const ussPath = getRandomUSSPath(baseDir);
        await accessor.makeDirectory(ussPath + '\nNewLine');
        const list = await accessor.listFiles(baseDir);
        const posn = ussPath.lastIndexOf('/');
        const fileName = ussPath.substring(posn + 1);
        expect(list.length).toBe(1);
        expect(list[0].name).toBe(fileName);
    });
});
