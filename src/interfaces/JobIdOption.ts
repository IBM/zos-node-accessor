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
 * Job query option.
 */
export interface JobIdOption {
    /**
     * Job ID, which is required
     */
    jobId: string;

    /**
     * Job owner, which is optional. **Default**: The current user
     */
    owner?: string;
}

/**
 * Job log query option.
 */
export interface JobLogOption extends JobIdOption {
    /**
     * Spool file index (1, 2, 3...), or -1, which returns all spool files separated
     * by `!! END OF JES SPOOL FILE !!`. **Default**: -1
     */
    fileId?: number;
}
