import React from 'react';
import './SimpleHeader.css';

interface SimpleHeaderProps {
  title: string;
}

const SimpleHeader: React.FC<SimpleHeaderProps> = ({ title }) => {
  return (
    <header className="simple-header">
      <div className="simple-header-content">
        <h1 className="simple-header-title">{title}</h1>
      </div>
    </header>
  );
};

export default SimpleHeader;