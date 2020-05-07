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

import { ZosAccessor, JobStatusResult } from '../zosAccessor';
import { connectFTPServer, submitHelloJob } from './testUtils';
import { JobIdOption } from '../interfaces/JobIdOption';

describe('The method of queryJob()', () => {

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

    it('can return NOT FOUND before the job can be listed', async () => {
        const queryOption: JobIdOption = {
            jobId: 'WRONG',
        };
        const status = await accessor.queryJob(queryOption);
        expect(status).toBe(JobStatusResult.NOT_FOUND);
    });

    it('can return SUCCESS after the job succeeds', async () => {
        const { status: status1, jobId } = await submitHelloJob(accessor);
        expect(status1.rc).toBe(0);

        const queryOption: JobIdOption = {
            jobId,
        };
        const status = await accessor.queryJob(queryOption);
        expect(status).toBe(JobStatusResult.SUCCESS);
    });

});
