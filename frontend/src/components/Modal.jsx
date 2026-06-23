import React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const Modal = ({ children, onClose }) => {
  const theme = useTheme();

  return (
    <Dialog
      open
      onClose={onClose}
      PaperProps={{
        sx: {
          backgroundColor:
            theme.palette.mode === "dark"
              ? theme.palette.background.default
              : "#fff",
          color: theme.palette.text.primary,
          borderRadius: 2,
          width: "90%",
          maxWidth: 500,
          p: 2,
        },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pb: 0,
        }}
      >
        <span>Report Preview</span>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ color: theme.palette.text.primary }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
    </Dialog>
  );
};

export default Modal;
