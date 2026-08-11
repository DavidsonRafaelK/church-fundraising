import fs from "fs";
import path from "path";
import { MedusaContainer } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createCollectionsWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductOptionsWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createStoresWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  uploadFilesWorkflow,
} from "@medusajs/medusa/core-flows";

export default async function initial_data_seed({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  );

  const countries = ["id"];

  logger.info("Seeding store data...");
  const {
    result: [defaultSalesChannel],
  } = await createSalesChannelsWorkflow(container).run({
    input: {
      salesChannelsData: [
        {
          name: "Default Sales Channel",
          description: "Created by Medusa",
        },
      ],
    },
  });

  const {
    result: [publishableApiKey],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        {
          title: "Default Publishable API Key",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  });

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel.id],
    },
  });

  const {
    result: [store],
  } = await createStoresWorkflow(container).run({
    input: {
      stores: [
        {
          name: "Default Store",
          supported_currencies: [
            {
              currency_code: "idr",
              is_default: true,
            },
          ],
          default_sales_channel_id: defaultSalesChannel.id,
        },
      ],
    },
  });

  logger.info("Seeding region data...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Indonesia",
          currency_code: "idr",
          countries,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  });
  const region = regionResult[0];
  logger.info("Finished seeding regions.");

  logger.info("Seeding tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
    })),
  });
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Indonesia Warehouse",
          address: {
            city: "Jakarta",
            country_code: "ID",
            address_1: "",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  logger.info("Seeding fulfillment data...");
  // This is created by a migration script in core.
  const { data: shippingProfileResult } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  });
  const shippingProfile = shippingProfileResult[0];

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Indonesia Warehouse delivery",
    type: "shipping",
    service_zones: [
      {
        name: "Indonesia",
        geo_zones: [
          {
            country_code: "id",
            type: "country",
          },
        ],
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Ship in 2-3 days.",
          code: "standard",
        },
        prices: [
          {
            currency_code: "idr",
            amount: 15000,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Express Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Ship in 24 hours.",
          code: "express",
        },
        prices: [
          {
            currency_code: "idr",
            amount: 30000,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  });
  logger.info("Finished seeding fulfillment data.");

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel.id],
    },
  });
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding product data...");

  logger.info("Uploading product images...");

  const productImageFiles = [
    { filename: "asinan-buah.jpeg", relativePath: "asinan/asinan-buah.jpeg" },
    {
      filename: "asinan-bumbu-kacang-dan-asinan-cuka-ebi.jpeg",
      relativePath: "asinan/asinan-bumbu-kacang-dan-asinan-cuka-ebi.jpeg",
    },
    {
      filename: "asinan-sayur.jpeg",
      relativePath: "asinan/asinan-sayur.jpeg",
    },
    {
      filename: "brownies-almond.jpeg",
      relativePath: "brownies/brownies-almond.jpeg",
    },
    {
      filename: "brownies-choco-crunchy.jpeg",
      relativePath: "brownies/brownies-choco-crunchy.jpeg",
    },
    {
      filename: "brownies-keju.jpeg",
      relativePath: "brownies/brownies-keju.jpeg",
    },
    {
      filename: "brownies-tiramond.jpeg",
      relativePath: "brownies/brownies-tiramond.jpeg",
    },
    {
      filename: "chicken-egg-roll.jpeg",
      relativePath: "gorengan-cemilan/chicken-egg-roll.jpeg",
    },
    {
      filename: "kentang-ebi.jpeg",
      relativePath: "gorengan-cemilan/kentang-ebi.jpeg",
    },
    {
      filename: "kentang-ebi-2.jpeg",
      relativePath: "gorengan-cemilan/kentang-ebi-2.jpeg",
    },
    {
      filename: "kentang-ebi-3.jpeg",
      relativePath: "gorengan-cemilan/kentang-ebi-3.jpeg",
    },
    {
      filename: "keripik-tempe.jpeg",
      relativePath: "gorengan-cemilan/keripik-tempe.jpeg",
    },
    {
      filename: "pastel.jpeg",
      relativePath: "gorengan-cemilan/pastel.jpeg",
    },
    {
      filename: "pastel-2.jpeg",
      relativePath: "gorengan-cemilan/pastel-2.jpeg",
    },
    {
      filename: "siomay.jpeg",
      relativePath: "gorengan-cemilan/siomay.jpeg",
    },
    {
      filename: "tahu-isi.jpeg",
      relativePath: "gorengan-cemilan/tahu-isi.jpeg",
    },
    {
      filename: "fukien-ikan.jpeg",
      relativePath: "lainnya/fukien-ikan.jpeg",
    },
    {
      filename: "macaroni-schotel.jpeg",
      relativePath: "lainnya/macaroni-schotel.jpeg",
    },
    {
      filename: "pempek-ikan.jpeg",
      relativePath: "lainnya/pempek-ikan.jpeg",
    },
    {
      filename: "sate-babi.jpeg",
      relativePath: "lainnya/sate-babi.jpeg",
    },
  ];

  const { result: uploadedImages } = await uploadFilesWorkflow(container).run(
    {
      input: {
        files: productImageFiles.map((file) => ({
          filename: file.filename,
          mimeType: "image/jpeg",
          content: fs
            .readFileSync(
              path.resolve(
                __dirname,
                "../../../storefront/public/makanan",
                file.relativePath
              )
            )
            .toString("base64"),
          access: "public" as const,
        })),
      },
    }
  );

  const imageUrlByFilename = new Map(
    uploadedImages.map(
      (file, index): [string, string] => [
        productImageFiles[index].filename,
        file.url,
      ]
    )
  );
  const imageUrl = (filename: string) => ({
    url: imageUrlByFilename.get(filename)!,
  });

  logger.info("Finished uploading product images.");

  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "Asinan",
          is_active: true,
        },
        {
          name: "Brownies",
          is_active: true,
        },
        {
          name: "Gorengan & Cemilan",
          is_active: true,
        },
        {
          name: "Lainnya",
          is_active: true,
        },
      ],
    },
  });

  const { result: collectionResult } = await createCollectionsWorkflow(
    container
  ).run({
    input: {
      collections: [
        {
          title: "Favorit",
          handle: "favorit",
        },
      ],
    },
  });
  const favoritCollection = collectionResult.find(
    (c) => c.title === "Favorit"
  )!;

  const { result: productOptionsResult } = await createProductOptionsWorkflow(
    container
  ).run({
    input: {
      product_options: [
        {
          title: "Rasa",
          values: ["Bumbu Kacang", "Cuka Ebi"],
        },
      ],
    },
  });
  const rasaOption = productOptionsResult.find((o) => o.title === "Rasa")!;

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Asinan Buah",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Asinan")!.id,
          ],
          description:
            "Asinan buah segar berisi campuran buah-buahan pilihan yang dipadukan dengan bumbu kacang khas asinan. Dibuat langsung oleh ibu-ibu gereja dengan bahan segar setiap hari, cocok dinikmati sebagai camilan menyegarkan di siang hari.",
          handle: "asinan-buah",
          weight: 500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [imageUrl("asinan-buah.jpeg")],
          options: [
            { title: "Title", values: ["Default"] },
          ],
          variants: [
            {
              title: "Asinan Buah",
              sku: "ASINAN-BUAH",
              options: {
                Title: "Default",
              },
              prices: [
                {
                  amount: 25000,
                  currency_code: "idr",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Asinan Sayur",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Asinan")!.id,
          ],
          description:
            "Asinan sayur berisi campuran sayuran segar seperti kol, tauge, dan mentimun yang direndam dalam kuah asam pedas khas asinan. Buatan rumahan gereja, disiapkan fresh setiap pesanan agar sayuran tetap renyah.",
          handle: "asinan-sayur",
          weight: 500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [imageUrl("asinan-sayur.jpeg")],
          options: [
            { title: "Title", values: ["Default"] },
          ],
          variants: [
            {
              title: "Asinan Sayur",
              sku: "ASINAN-SAYUR",
              options: {
                Title: "Default",
              },
              prices: [
                {
                  amount: 22000,
                  currency_code: "idr",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Asinan Bumbu Kacang & Cuka Ebi",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Asinan")!.id,
          ],
          description:
            "Asinan sayur dan buah dengan pilihan dua saus khas: bumbu kacang yang gurih manis atau cuka ebi yang segar asam pedas. Dibuat homemade oleh gereja menggunakan bahan-bahan segar pilihan, cocok untuk yang ingin mencoba dua cita rasa asinan sekaligus.",
          handle: "asinan-bumbu-kacang-cuka-ebi",
          weight: 500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            imageUrl("asinan-bumbu-kacang-dan-asinan-cuka-ebi.jpeg"),
          ],
          options: [{ id: rasaOption.id }],
          variants: [
            {
              title: "Bumbu Kacang",
              sku: "ASINAN-BUMBU-KACANG",
              options: {
                Rasa: "Bumbu Kacang",
              },
              prices: [
                {
                  amount: 25000,
                  currency_code: "idr",
                },
              ],
            },
            {
              title: "Cuka Ebi",
              sku: "ASINAN-CUKA-EBI",
              options: {
                Rasa: "Cuka Ebi",
              },
              prices: [
                {
                  amount: 25000,
                  currency_code: "idr",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Brownies Almond",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Brownies")!.id,
          ],
          description:
            "Brownies cokelat lembut dengan taburan almond panggang di atasnya, dipanggang langsung dalam loyang oleh dapur gereja. Tekstur fudgy dan aroma cokelat yang pekat menjadikannya favorit untuk oleh-oleh maupun suguhan acara.",
          handle: "brownies-almond",
          weight: 500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [imageUrl("brownies-almond.jpeg")],
          options: [
            { title: "Title", values: ["Default"] },
          ],
          variants: [
            {
              title: "Brownies Almond",
              sku: "BROWNIES-ALMOND",
              options: {
                Title: "Default",
              },
              prices: [
                {
                  amount: 45000,
                  currency_code: "idr",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Brownies Choco Crunchy",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Brownies")!.id,
          ],
          collection_id: favoritCollection.id,
          description:
            "Brownies cokelat dengan tambahan crunchy chocochips yang memberikan sensasi renyah di setiap gigitan. Dibuat homemade oleh gereja dengan resep rumahan, cocok dinikmati bersama keluarga atau sebagai bingkisan.",
          handle: "brownies-choco-crunchy",
          weight: 550,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [imageUrl("brownies-choco-crunchy.jpeg")],
          options: [
            { title: "Title", values: ["Default"] },
          ],
          variants: [
            {
              title: "Brownies Choco Crunchy",
              sku: "BROWNIES-CHOCO-CRUNCHY",
              options: {
                Title: "Default",
              },
              prices: [
                {
                  amount: 48000,
                  currency_code: "idr",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Brownies Keju",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Brownies")!.id,
          ],
          collection_id: favoritCollection.id,
          description:
            "Brownies cokelat lembut dengan taburan keju parut melimpah di atasnya, memberikan perpaduan rasa manis dan gurih yang khas. Dipanggang segar dalam loyang oleh dapur gereja, favorit banyak pelanggan.",
          handle: "brownies-keju",
          weight: 500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [imageUrl("brownies-keju.jpeg")],
          options: [
            { title: "Title", values: ["Default"] },
          ],
          variants: [
            {
              title: "Brownies Keju",
              sku: "BROWNIES-KEJU",
              options: {
                Title: "Default",
              },
              prices: [
                {
                  amount: 45000,
                  currency_code: "idr",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Brownies Tiramond",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Brownies")!.id,
          ],
          description:
            "Brownies dengan perpaduan rasa tiramisu lembut dan taburan almond panggang, memberikan cita rasa unik dan premium. Dibuat homemade oleh gereja dalam loyang, cocok sebagai hadiah maupun suguhan spesial.",
          handle: "brownies-tiramond",
          weight: 550,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [imageUrl("brownies-tiramond.jpeg")],
          options: [
            { title: "Title", values: ["Default"] },
          ],
          variants: [
            {
              title: "Brownies Tiramond",
              sku: "BROWNIES-TIRAMOND",
              options: {
                Title: "Default",
              },
              prices: [
                {
                  amount: 50000,
                  currency_code: "idr",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Chicken Egg Roll",
          category_ids: [
            categoryResult.find(
              (cat) => cat.name === "Gorengan & Cemilan"
            )!.id,
          ],
          collection_id: favoritCollection.id,
          description:
            "Egg roll ayam gulung renyah berisi campuran ayam cincang dan sayuran, digoreng garing keemasan. Dibuat fresh oleh dapur gereja setiap pesanan, cocok sebagai camilan atau lauk pendamping.",
          handle: "chicken-egg-roll",
          weight: 350,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [imageUrl("chicken-egg-roll.jpeg")],
          options: [
            { title: "Title", values: ["Default"] },
          ],
          variants: [
            {
              title: "Chicken Egg Roll",
              sku: "CHICKEN-EGG-ROLL",
              options: {
                Title: "Default",
              },
              prices: [
                {
                  amount: 20000,
                  currency_code: "idr",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Kentang Ebi",
          category_ids: [
            categoryResult.find(
              (cat) => cat.name === "Gorengan & Cemilan"
            )!.id,
          ],
          collection_id: favoritCollection.id,
          description:
            "Kentang goreng kering yang dipadukan dengan ebi (udang kering) dan bumbu pedas manis, renyah dan gurih di setiap gigitan. Camilan buatan rumahan gereja ini cocok dinikmati langsung atau sebagai teman nasi.",
          handle: "kentang-ebi",
          weight: 300,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            imageUrl("kentang-ebi.jpeg"),
            imageUrl("kentang-ebi-2.jpeg"),
            imageUrl("kentang-ebi-3.jpeg"),
          ],
          options: [
            { title: "Title", values: ["Default"] },
          ],
          variants: [
            {
              title: "Kentang Ebi",
              sku: "KENTANG-EBI",
              options: {
                Title: "Default",
              },
              prices: [
                {
                  amount: 18000,
                  currency_code: "idr",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Keripik Tempe",
          category_ids: [
            categoryResult.find(
              (cat) => cat.name === "Gorengan & Cemilan"
            )!.id,
          ],
          description:
            "Keripik tempe tipis renyah yang digoreng garing dengan bumbu gurih khas rumahan. Dibuat dari tempe segar pilihan oleh dapur gereja, cocok sebagai camilan sehat maupun oleh-oleh.",
          handle: "keripik-tempe",
          weight: 300,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [imageUrl("keripik-tempe.jpeg")],
          options: [
            { title: "Title", values: ["Default"] },
          ],
          variants: [
            {
              title: "Keripik Tempe",
              sku: "KERIPIK-TEMPE",
              options: {
                Title: "Default",
              },
              prices: [
                {
                  amount: 15000,
                  currency_code: "idr",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Pastel",
          category_ids: [
            categoryResult.find(
              (cat) => cat.name === "Gorengan & Cemilan"
            )!.id,
          ],
          description:
            "Pastel goreng berisi sayuran, telur, dan soun yang dibalut kulit renyah garing. Dibuat fresh oleh dapur gereja setiap pesanan, nikmat disantap hangat sebagai camilan atau sarapan.",
          handle: "pastel",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [imageUrl("pastel.jpeg"), imageUrl("pastel-2.jpeg")],
          options: [
            { title: "Title", values: ["Default"] },
          ],
          variants: [
            {
              title: "Pastel",
              sku: "PASTEL",
              options: {
                Title: "Default",
              },
              prices: [
                {
                  amount: 20000,
                  currency_code: "idr",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Siomay",
          category_ids: [
            categoryResult.find(
              (cat) => cat.name === "Gorengan & Cemilan"
            )!.id,
          ],
          description:
            "Siomay ikan kukus yang lembut, disajikan dengan siraman saus kacang gurih khas. Dibuat homemade oleh gereja menggunakan ikan segar pilihan, cocok sebagai camilan mengenyangkan.",
          handle: "siomay",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [imageUrl("siomay.jpeg")],
          options: [
            { title: "Title", values: ["Default"] },
          ],
          variants: [
            {
              title: "Siomay",
              sku: "SIOMAY",
              options: {
                Title: "Default",
              },
              prices: [
                {
                  amount: 22000,
                  currency_code: "idr",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Tahu Isi",
          category_ids: [
            categoryResult.find(
              (cat) => cat.name === "Gorengan & Cemilan"
            )!.id,
          ],
          description:
            "Tahu goreng berisi campuran sayuran dan tauge yang gurih, digoreng dengan balutan tepung renyah. Dibuat fresh oleh dapur gereja setiap pesanan, nikmat disantap hangat dengan cabai rawit.",
          handle: "tahu-isi",
          weight: 350,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [imageUrl("tahu-isi.jpeg")],
          options: [
            { title: "Title", values: ["Default"] },
          ],
          variants: [
            {
              title: "Tahu Isi",
              sku: "TAHU-ISI",
              options: {
                Title: "Default",
              },
              prices: [
                {
                  amount: 17000,
                  currency_code: "idr",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Fukien Ikan",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Lainnya")!.id,
          ],
          description:
            "Fukien ikan, gulungan ikan giling yang digoreng garing dengan tekstur kenyal gurih khas olahan ikan. Dibuat homemade oleh gereja dari ikan segar pilihan, cocok sebagai lauk maupun camilan berat.",
          handle: "fukien-ikan",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [imageUrl("fukien-ikan.jpeg")],
          options: [
            { title: "Title", values: ["Default"] },
          ],
          variants: [
            {
              title: "Fukien Ikan",
              sku: "FUKIEN-IKAN",
              options: {
                Title: "Default",
              },
              prices: [
                {
                  amount: 30000,
                  currency_code: "idr",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Macaroni Schotel",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Lainnya")!.id,
          ],
          description:
            "Macaroni schotel panggang dengan campuran daging cincang, keju, dan susu yang creamy, dipanggang hingga permukaannya kecokelatan. Dibuat homemade oleh dapur gereja, cocok sebagai hidangan keluarga maupun bekal acara.",
          handle: "macaroni-schotel",
          weight: 500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [imageUrl("macaroni-schotel.jpeg")],
          options: [
            { title: "Title", values: ["Default"] },
          ],
          variants: [
            {
              title: "Macaroni Schotel",
              sku: "MACARONI-SCHOTEL",
              options: {
                Title: "Default",
              },
              prices: [
                {
                  amount: 35000,
                  currency_code: "idr",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Pempek Ikan",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Lainnya")!.id,
          ],
          description:
            "Pempek ikan kenyal khas Palembang yang dibuat dari ikan segar pilihan, disajikan dengan kuah cuko asam pedas. Dibuat homemade oleh dapur gereja dengan resep rumahan turun-temurun.",
          handle: "pempek-ikan",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [imageUrl("pempek-ikan.jpeg")],
          options: [
            { title: "Title", values: ["Default"] },
          ],
          variants: [
            {
              title: "Pempek Ikan",
              sku: "PEMPEK-IKAN",
              options: {
                Title: "Default",
              },
              prices: [
                {
                  amount: 25000,
                  currency_code: "idr",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Sate Babi",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Lainnya")!.id,
          ],
          description:
            "Sate babi bumbu manis khas rumahan, dipanggang hingga matang sempurna dengan aroma bumbu yang meresap. Dibuat fresh oleh dapur gereja setiap pesanan, nikmat disantap dengan lontong atau nasi hangat.",
          handle: "sate-babi",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [imageUrl("sate-babi.jpeg")],
          options: [
            { title: "Title", values: ["Default"] },
          ],
          variants: [
            {
              title: "Sate Babi",
              sku: "SATE-BABI",
              options: {
                Title: "Default",
              },
              prices: [
                {
                  amount: 35000,
                  currency_code: "idr",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
      ],
    },
  });

  logger.info("Finished seeding product data.");

  logger.info("Seeding inventory levels.");

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryItems.map((item) => ({
        location_id: stockLocation.id,
        stocked_quantity: 1000000,
        inventory_item_id: item.id,
      })),
    },
  });

  logger.info("Finished seeding inventory levels data.");
}
