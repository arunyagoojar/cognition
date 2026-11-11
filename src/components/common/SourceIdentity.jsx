import React from 'react';
import { sourceIdentity } from '../../utils/sourceIdentity.js';
import './sourceIdentity.css';
export default function SourceIdentity({ test, skill }) {
  const identity = sourceIdentity(test, skill);
  if (!identity) return null;
  return <div className="exam-source-identity" data-source-status={identity.code} title={identity.detail}>
    <span>{identity.primary}</span><span aria-hidden="true">·</span>
    {identity.href ? <a href={identity.href} target="_blank" rel="noopener noreferrer" aria-label={`${identity.status}. ${identity.detail}`}>{identity.status}</a> : <span>{identity.status}</span>}
  </div>;
}
