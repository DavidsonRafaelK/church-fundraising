import { Github } from "@medusajs/icons";
import { Button, Heading } from "@modules/common/components/ui";
const Hero = () => {
  return (
    <div className="h-[75vh] w-full border-b border-ui-border-base relative bg-ui-bg-subtle">
      <div className="absolute inset-0 z-10 flex flex-col justify-center items-center text-center small:p-32 gap-6">
        <span>
          <Heading
            level="h1"
            className="text-3xl leading-10 text-ui-fg-base font-normal"
          >
            Template Awal E-commerce
          </Heading>
          <Heading
            level="h2"
            className="text-3xl leading-10 text-ui-fg-subtle font-normal"
          >
            Didukung oleh Medusa dan Next.js
          </Heading>
        </span>
        <a href="https://github.com/medusajs/dtc-starter" target="_blank">
          <Button variant="secondary">
            Lihat di GitHub <Github />
          </Button>
        </a>
      </div>
    </div>
  );
};

export default Hero;
