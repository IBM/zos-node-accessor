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

/**
 * Spool file.
 */
export interface SpoolFile {
    /**
     * Spool file ID
     */
    id: number;

    /**
     * Job step name
     */
    stepName?: string;

    /**
     * Proc step name
     */
    procStep?: string;

    /**
     * Class
     */
    class?: string;

    /**
     * DD name
     */
    ddName?: string;

    /**
     * Bytes
     */
    byteCount?: number;

    /**
     * Deprecated. Just for migration from zos-node-accessor v1.0.x to v2.x.
     */
    [key: string]: any;
}
