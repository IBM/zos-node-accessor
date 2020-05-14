/****************************************************************************/
/*                                                                          */
/* Copyright (c) 2017,2020 IBM Corp.                                        */
/* All rights reserved. This program and the accompanying materials         */
/* are made available under the terms of the Eclipse Public License v1.0    */
/* which accompanies this distribution, and is available at                 */
/* http://www.eclipse.org/legal/epl-v10.html                                */
/*                                                                          */
/* Contributors:                                                            */
/*  IBM Corp. - initial API and implementation                              */
/*                                                                          */
/****************************************************************************/

import { SpoolFile } from './SpoolFile';

/**
 * Job information.
 */
export interface Job {
    /**
     * Job name
     */
    jobName: string;

    /**
     * Job ID
     */
    jobId: string;

    /**
     * Job owner
     */
    owner: string;

    /**
     * Job status
     */
    status: string;

    /**
     * Job class
     */
    class: string;

    /**
     * Extra information
     */
    extra?: string;
}

/**
 * Job status including rc, spool files, etc.
 */
export interface JobStatus extends Job {
    /**
     * Job RC value, indicating job finished with numberic value or failed with error string.
     */
    rc?: string | number;

    /**
     * Spool files.
     */
    spoolFiles?: SpoolFile[];
}
