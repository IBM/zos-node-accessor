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

import { ZosAccessor, JobIdOption } from '../zosAccessor';
import { connectFTPServer, submitHelloJob } from './testUtils';

describe('The method of submitJCL()', () => {

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

    it('can delete job', async () => {
        const { status, jobId } = await submitHelloJob(accessor);
        expect(status.rc).toBe(0);

        const queryOption: JobIdOption = { jobId };
        await accessor.deleteJob(queryOption);

        try {
            await accessor.getJobStatus(queryOption);
        } catch (err) {
            expect(err.message).toContain('No jobs found');
        }
    });

    it('can get the error "Failed to submit jcl, job id not found", when submitting bad jcl', async () => {
        try {
            const queryOption: JobIdOption = { jobId: 'JOB12345' };
            await accessor.deleteJob(queryOption);
        } catch (err) {
            expect(err.message).toContain('Jobid J0012345 not found');
        }
    });

});
