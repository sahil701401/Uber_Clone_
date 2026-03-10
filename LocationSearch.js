import React, { useState, useRef, useEffect } from 'react';
import { JAIPUR_LOCATIONS } from '../utils/jaipurLocations';

export default function LocationSearch({ placeholder, value, onChange, icon }) {
  const [query, setQuery] = useState(value?.address || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInput = (val) => {
    setQuery(val);
    if (val.length > 1) {
      const filtered = JAIPUR_LOCATIONS.filter(
        loc =>
          loc.name.toLowerCase().includes(val.toLowerCase()) ||
          loc.address.toLowerCase().includes(val.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 6));
      setOpen(true);
    } else {
      setSuggestions([]);
      setOpen(false);
    }
  };

  const handleSelect = (loc) => {
    setQuery(loc.name);
    setSuggestions([]);
    setOpen(false);
    onChange({ address: `${loc.name}, ${loc.address}`, lat: loc.lat, lng: loc.lng });
  };

  return (
    <div className="location-search" ref={ref}>
      <div className="location-input-wrapper">
        <span className="loc-icon">{icon}</span>
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => query.length > 1 && setOpen(true)}
          className="location-input"
        />
        {query && (
          <button className="clear-btn" onClick={() => { setQuery(''); onChange(null); }}>✕</button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="suggestions-dropdown">
          {suggestions.map((loc, i) => (
            <div key={i} className="suggestion-item" onClick={() => handleSelect(loc)}>
              <span className="sug-icon">📍</span>
              <div>
                <div className="sug-name">{loc.name}</div>
                <div className="sug-addr">{loc.address}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
