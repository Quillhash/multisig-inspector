import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";

export function docsLayoutOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2 font-semibold">
          <Image
            src="/icon.svg"
            alt="Multisig Inspector"
            width={28}
            height={28}
            className="h-7 w-7 rounded-md"
          />
          Multisig Inspector
        </span>
      ),
      url: "/",
    },
  };
}
