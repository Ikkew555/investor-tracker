function buildTokens(isDark) {
  return isDark
    ? {
        pageBg:      "transparent",
        bg:          "#2a2a2a",
        surface:     "#2a2a2a",
        surfaceHover:"#333333",
        border:      "#3a3a3a",
        text:        "#f0f0f0",
        textSub:     "#bbbbbb",
        muted:       "#888888",
        accent:      "#4d9ef5",
        accentHover: "#6fb3ff",
        thBg:        "#1e1e1e",
        thText:      "#999999",
        rowAlt:      "rgba(255,255,255,0.03)",
        rowHover:    "rgba(255,255,255,0.05)",
        shadow:      "0 2px 8px rgba(0,0,0,0.4)",
        shadowH:     "0 8px 24px rgba(0,0,0,0.6)",
        cardBorder:  "#3a3a3a",
        cardBg:      "#2a2a2a",
        tableBorder: "#3a3a3a",
        statBg:      "#2a2a2a",
        // Franking meter — dark
        frankingBg:     "#0d2b22",
        frankingBorder: "#1a4a38",
        frankingText:   "#4ecda4",
        frankingMuted:  "#2e7d62",
        frankingValue:  "#4ecda4",
        // FY badge — dark
        fyBadgeBg:    "#1a2e45",
        fyBadgeText:  "#4d9ef5",
        // CGT calc icon — dark
        calcIconBg:   "#1a2e45",
        calcIconColor:"#4d9ef5",
        illBg: "#1e3340", ill1: "#2d5a6e", ill2: "#4a8fa8", ill3: "#7bbdd4", ill4: "#a8d8ea",
        // Tag colors — dark mode
        accentTag:     "#1a2e45", accentTagText: "#4d9ef5",
        mutedTag:      "#2a2a2a", mutedTagText:  "#888888",
        amberTag:      "#2a1e08", amberTagText:  "#d4930a",
        lossTag:       "#2a0f0f", lossTagText:   "#f09595",
      }
    : {
        pageBg:      "transparent",
        bg:          "#ffffff",
        surface:     "transparent",
        surfaceHover:"#f8f8f8",
        border:      "#e8e8e8",
        text:        "#111111",
        textSub:     "#444444",
        muted:       "#777777",
        accent:      "#1a6fe8",
        accentHover: "#1558c0",
        thBg:        "#f0f2f4",
        thText:      "#444444",
        rowAlt:      "rgba(0,0,0,0.02)",
        rowHover:    "rgba(0,0,0,0.04)",
        shadow:      "0 2px 8px rgba(0,0,0,0.08)",
        shadowH:     "0 8px 24px rgba(0,0,0,0.12)",
        cardBorder:  "none",
        cardBg:      "transparent",
        tableBorder: "#e8e8e8",
        statBg:      "transparent",
        // Franking meter — light
        frankingBg:     "#E1F5EE",
        frankingBorder: "#9FE1CB",
        frankingText:   "#0F6E56",
        frankingMuted:  "#1D9E75",
        frankingValue:  "#0F6E56",
        // FY badge — light
        fyBadgeBg:    "#E6F1FB",
        fyBadgeText:  "#0C447C",
        // CGT calc icon — light
        calcIconBg:   "#E6F1FB",
        calcIconColor:"#185FA5",
        illBg: "#1e3340", ill1: "#2d5a6e", ill2: "#4a8fa8", ill3: "#7bbdd4", ill4: "#a8d8ea",
        // Tag colors — light mode
        accentTag:     "#E6F1FB", accentTagText: "#0C447C",
        mutedTag:      "#F1EFE8", mutedTagText:  "#5F5E5A",
        amberTag:      "#FAEEDA", amberTagText:  "#633806",
        lossTag:       "#FCEBEB", lossTagText:   "#A32D2D",
      };
}

export function useTheme(mode) {
  return buildTokens(mode === "dark");
}