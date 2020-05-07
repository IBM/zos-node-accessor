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
 * Dataset member entry
 */
export interface DatasetMemberEntry extends Entry {
    /**
     * Changed date
     */
    changed?: string;

    /**
     * Created date
     */
    created?: string;

    /**
     * Member name
     */
    name: string;

    /**
     * Size
     */
    size?: number;

    /**
     * Version
     */
    version?: string;
}
