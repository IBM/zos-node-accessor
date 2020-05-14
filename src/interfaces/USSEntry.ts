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

import { Entry } from './Entry';

/**
 * USS file or directory entry.
 */
export interface USSEntry extends Entry {
    /**
     * File or directory name
     */
    name: string;

    /**
     * Group
     */
    group: string;

    /**
     * File type
     */
    fileType: FileType;

    /**
     * The target file if this entry is the link
     */
    linkTo?: string;

    /**
     * Last modified date
     */
    lastModified: Date;

    /**
     * Owner
     */
    owner: string;

    /**
     * Permission string
     */
    permissions: string;

    /**
     * File size
     */
    size: number;
}

export enum FileType {
    /**
     * Directory
     */
    DIRECTORY,

    /**
     * File
     */
    FILE,

    /**
     * Symbol link
     */
    LINK,
}
