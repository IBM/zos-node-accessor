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

/**
 * Job list option. All members are optional. The different job query function depends on different memebers,
 * and will check their existance.
 */
export interface JobListOption {
    /**
     * Job name, which is optional and can contain a wildcard (*). **Default**: '*'
     */
    jobName?: string;

    /**
     * Job ID, which is optional
     */
    jobId?: string;

    /**
     * Job owner, which is optional and can contain a wildcard (*). **Default**: The current user
     */
    owner?: string;

    /**
     * Job status, eg. ALL, OUTPUT, which is optional. **Default**: 'ALL'
     */
    status?: string;
}
