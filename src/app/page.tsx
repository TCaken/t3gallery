import { db } from "~/server/db/index";
import { images } from "~/server/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// Define the post type based on your schema
type Image = InferSelectModel<typeof images>;

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const dbImages = await db.query.images.findMany({
    orderBy: (model, { desc }) => desc(model.id),
  }) as Image[];  
  console.log("Database images:", dbImages);


  return (
    <main className="">
      <h3 className="text-xl">Images from database:</h3>
      <div className="flex flex-wrap gap-4">
        {[...dbImages, ...dbImages, ...dbImages].map((image, index) => (
          <div key={image.id + " " + index} className="flex flex-col w-48">
            <img src={image.url} alt={image.name}/>
            <div>{image.name}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
