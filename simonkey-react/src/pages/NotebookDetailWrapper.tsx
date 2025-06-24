import React from 'react';
import NotebookDetail from './NotebookDetail';

/**
 * Wrapper component that renders the appropriate notebook detail page
 * based on whether the user is a school student or regular user
 */
const NotebookDetailWrapper: React.FC = () => {
  // School students now use the regular NotebookDetail component
  // with restrictions handled inside the component
  return <NotebookDetail />;
};

export default NotebookDetailWrapper;