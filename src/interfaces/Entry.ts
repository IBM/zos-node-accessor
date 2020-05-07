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
 * Base entry of Dataset/Member/USS File/USS Directory.
 */
export interface Entry {

    /**
     * Raw string returned from FTP
     */
    rawString: string;

    /**
     * Field names of the table header returned from FTP
     */
    fieldNames: string[];

    /**
     * Deprecated. Just for migration from zos-node-accessor v1.0.x to v2.x.
     */
    [key: string]: any;
}
