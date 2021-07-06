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

describe('The method of site()', () => {
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

    it('can submit site commands correctly', async () => {
        let result = await accessor.stat('umask');
        expect(result).not.toContain('000');

        await accessor.site('umask 000');
        result = await accessor.stat('umask');
        expect(result).toContain('000');
    });

    it('can return proper error message with bad syntax site command', async() => {
        const result = await accessor.site('umask=000');
        expect(result).toContain('Umask invalid syntax');
    });    
});
