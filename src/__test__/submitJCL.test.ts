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

import { JobStatusResult, ZosAccessor } from '../zosAccessor';
import { connectFTPServer, getHelloJcl, sleep } from './testUtils';

describe('The method of submitJCL()', () => {

    jest.setTimeout(60000);
    let accessor: ZosAccessor;

    beforeEach(async () => {
        accessor = await connectFTPServer();
    });

    afterEach(async() => {
        if (accessor) {
            await accessor.close();
        }
    });

    it('can submit HELLO jcl', async () => {
        const jcl = getHelloJcl();
        const jobId = await accessor.submitJCL(jcl.jcl);
        let rc = await accessor.queryJob({ jobId });
        while (rc !== JobStatusResult.SUCCESS && rc !== JobStatusResult.FAIL) {
            rc = await accessor.queryJob({ jobId });
            await sleep(5000);
        }
        expect(rc).toBe(JobStatusResult.SUCCESS);
    });

    it('can get the error "Failed to submit jcl, job id not found", when submitting bad jcl', async () => {
        try {
            await accessor.submitJCL('Bad JCL');
        } catch (err) {
            expect(err.message).toContain('Failed to submit jcl, job id not found')
        }
    });

});
