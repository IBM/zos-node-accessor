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

// Dataset entry with raw string returned from FTP and key/value pairs
export interface DatasetEntry extends Entry {
    /**
     * Block size
     */
    blockSize?: number;

    /**
     * Dataset organization
     */
    dsOrg?: string;

    /**
     * How many extends
     */
    extends?: number;

    /**
     * Dataset name
     */
    name: string;

    /**
     * Is migrated or not. When migrated, many attributes like recordLength is unknown.
     */
    isMigrated: boolean;

    /**
     * Record format
     */
    recordFormat?: string;

    /**
     * Record length
     */
    recordLength?: number;

    /**
     * Last referred date
     */
    referred?: string;

    /**
     * Device unit
     */
    unit?: string;

    /**
     * Used tracks
     */
    usedTracks?: number;

    /**
     * Volumne
     */
    volume?: string;
}
