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

import { TransferMode, ZosAccessor} from '../zosAccessor';
import { connectFTPServer, getUSSPath } from './testUtils';

describe('The method of downloadFile()', () => {

    jest.setTimeout(60000);

    let accessor: ZosAccessor;

    beforeEach(async () => {
        accessor = await connectFTPServer();
    });

    afterEach(async () => {
        if (accessor) {
            await accessor.close();
        }
    });

    // Can get USS file in ASCII mode
    it('can get USS file in ASCII mode', async () => {
        const text = 'Hello\r\n';

        const buffer = await accessor.downloadFile(getUSSPath('nodeacc/hello.txt'), TransferMode.ASCII);
        expect(buffer.toString()).toBe(text);
    });

    // Can get USS file in BINARY mode
    it('can get USS file in BINARY mode', async () => {
        const text = 'c88593939615';

        const buffer = await accessor.downloadFile(getUSSPath('nodeacc/hello.txt'), TransferMode.BINARY);
        expect(buffer.toString('hex')).toBe(text);
    });

    // Can get USS file in ASCII_STRIP_EOL mode
    it('can get USS file in ASCII_STRIP_EOL mode', async () => {
        const text = 'Hello';

        const buffer = await accessor.downloadFile(getUSSPath('nodeacc/hello.txt'), TransferMode.ASCII_STRIP_EOL);
        expect(buffer.toString()).toBe(text);
    });

    it.only('can get USS file in ASCII_NO_TRAILING_BLANKS mode', async () => {
        const text = 'Hello\r\n';

        const buffer = await accessor.downloadFile(getUSSPath('nodeacc/hello_with_trailingblanks.txt'), TransferMode.ASCII_NO_TRAILING_BLANKS);
        expect(buffer.toString()).toBe(text);
    });

    // Can get USS file in ASCII mode as STREAM
    it('can get USS file in ASCII mode as STREAM', async () => {
        const text = 'Hello\r\n';

        const filePath = getUSSPath('nodeacc/hello.txt');
        const bufferOrStream = await accessor.downloadFile(filePath, TransferMode.ASCII, true);
        const stream = bufferOrStream as fs.ReadStream;
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
        });
        stream.on('end', () => {
            const buffer = Buffer.concat(chunks);
            expect(buffer.toString()).toBe(text);
        });
        stream.resume();
    });
});
