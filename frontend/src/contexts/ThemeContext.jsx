import React, { createContext, useState, useContext, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const ThemeContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);

export const ThemeProviderWrapper = ({ children }) => {
  const [mode, setMode] = useState('dark');

  // Load theme from localStorage on initial render
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setMode(savedTheme);
    }
  }, []);

  // Save theme to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('theme', mode);
    // Update the body class for global styling
    document.body.className = mode === 'dark' ? 'dark-mode' : 'light-mode';
    
    // Add a data attribute to html for components that can't use CSS variables
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const toggleTheme = () => {
    setMode(prevMode => (prevMode === 'dark' ? 'light' : 'dark'));
  };

  const setThemeMode = (newMode) => {
    if (newMode === 'dark' || newMode === 'light') {
      setMode(newMode);
    }
  };

  // Create theme based on current mode
  const theme = createTheme({
    palette: {
      mode: mode,
      ...(mode === 'light'
        ? {
            // Light mode colors
            primary: {
              main: '#1976d2',
            },
            secondary: {
              main: '#f50057',
            },
            background: {
              default: '#f5f5f5',
              paper: '#fff',
            },
            text: {
              primary: '#333',
              secondary: '#555',
            },
            divider: 'rgba(0, 0, 0, 0.1)',
            success: {
              main: '#4caf50',
            },
            error: {
              main: '#f44336',
            },
            warning: {
              main: '#ff9800',
            },
            info: {
              main: '#2196f3',
            },
          }
        : {
            // Dark mode colors
            primary: {
              main: '#90caf9',
            },
            secondary: {
              main: '#f48fb1',
            },
            background: {
              default: '#121212',
              paper: '#1e1e1e',
            },
            text: {
              primary: '#fff',
              secondary: '#ccc',
            },
            divider: 'rgba(255, 255, 255, 0.1)',
            success: {
              main: '#81c784',
            },
            error: {
              main: '#e57373',
            },
            warning: {
              main: '#ffb74d',
            },
            info: {
              main: '#64b5f6',
            },
          }),
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            transition: 'background-color 0.3s ease, color 0.3s ease',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: mode === 'dark' ? '#1e1e1e' : '#fff',
            transition: 'background-color 0.3s ease',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: mode === 'dark' ? '#1e1e1e' : '#fff',
            transition: 'background-color 0.3s ease',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            transition: 'background-color 0.3s ease, color 0.3s ease',
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            color: mode === 'dark' ? '#fff' : '#333',
          },
        },
      },
      MuiTable: {
        styleOverrides: {
          root: {
            backgroundColor: mode === 'dark' ? '#1e1e1e' : '#fff',
            transition: 'background-color 0.3s ease',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottomColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            color: mode === 'dark' ? '#fff' : '#333',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: mode === 'dark' ? '#333' : '#eee',
            },
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            color: mode === 'dark' ? '#fff' : '#333',
          },
          input: {
            '&::placeholder': {
              color: mode === 'dark' ? '#aaa' : '#777',
              opacity: 1,
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: mode === 'dark' ? '#555' : '#ccc',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: mode === 'dark' ? '#777' : '#999',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            backgroundColor: mode === 'dark' ? '#333' : '#e0e0e0',
          },
        },
      },
      MuiList: {
        styleOverrides: {
          root: {
            backgroundColor: mode === 'dark' ? '#1e1e1e' : '#fff',
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: mode === 'dark' ? '#333' : '#eee',
            },
          },
        },
      },
    },
  });

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setThemeMode }}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};