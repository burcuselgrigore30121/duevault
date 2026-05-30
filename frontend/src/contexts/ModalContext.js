import { createContext, useContext, useState } from 'react';

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [addItemModal, setAddItemModal] = useState({ open: false, item: null, defaultType: null });

  const openAddModal = (defaultType = null) => setAddItemModal({ open: true, item: null, defaultType });
  const openEditModal = (item) => setAddItemModal({ open: true, item, defaultType: null });
  const closeModal = () => setAddItemModal({ open: false, item: null, defaultType: null });

  return (
    <ModalContext.Provider value={{ addItemModal, openAddModal, openEditModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
}

export const useModal = () => useContext(ModalContext);
