import { createCn } from "cn/config"

// Teach class merging about Creavent's custom tokens, so `text-label` (a size)
// and `text-ink` (a color) don't cancel each other out.
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display", "h1", "h2", "h3", "body-lg", "body", "sm", "label",
            "help", "eyebrow", "cap", "price", "stat", "mono",
          ],
        },
      ],
      shadow: [{ shadow: ["up"] }],
      rounded: [{ rounded: ["pill"] }],
    },
  },
})
