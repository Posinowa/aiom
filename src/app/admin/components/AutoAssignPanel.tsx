'use client';
import React from 'react';

interface AutoAssignPanelProps {
    companyID: string;
}

export default function AutoAssignPanel({ companyID }: AutoAssignPanelProps) {
    return (
        <div>
            <h4 className="text-sm font-medium">Auto Assign Panel</h4>
            <p className="text-xs text-slate-500">CompanyID: {companyID}</p>
            {/* Burada companyID ile yapılacak işleri kodlarsın */}
        </div>
    );
}
