/****************************************************************************/
/*                                                                          */
/* Copyright (c) 2021 IBM Corp.                                             */
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
import { connectFTPServer } from './testUtils';

describe('The method of stat()', () => {
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

    it('can submit stat commands without argument correctly', async () => {
        let result = await accessor.stat();
        expect(result).toContain('UMASK');
    });

    it('can submit stat/site commands correctly', async () => {
        let result = await accessor.stat('umask');
        expect(result).not.toContain('000');

        result = await accessor.stat('SBSENDEOL');
        expect(result).not.toContain(' LF ');

        await accessor.site('umask 000 SBSENDEOL=LF');
        result = await accessor.stat('umask');
        expect(result).toContain('000');
        result = await accessor.stat('SBSENDEOL');
        expect(result).toContain('LF');
    });
});
