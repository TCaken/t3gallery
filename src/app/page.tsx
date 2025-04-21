import Link from "next/link";
import Image from "next/image";
const mockUrls = [
  "https://xzymzk73e9.ufs.sh/f/3SklIw8OvxkH2b6osNj0XDKLvBsqfGS7l5tRTFgr4Qea3Iy8",
  "https://xzymzk73e9.ufs.sh/f/3SklIw8OvxkHvuKzes7dqg2kUSHLjGFtaRd5y3J7CspvKEoc",
  "https://xzymzk73e9.ufs.sh/f/3SklIw8OvxkHkP2N5vb96qegH8LpD20SWFIjuodyaNtfwQ9Y",
  "https://xzymzk73e9.ufs.sh/f/3SklIw8OvxkHUFi4MZiQtrlR9KQ6pnEH5ydMe2IOxXbhPcio"
]

const mockImages = mockUrls.map((url, index) => ({
  id: index,
  url,
  title: `Mock Image ${index + 1}`,
  description: `Mock Description ${index + 1}`
}))

export default function HomePage() {
  return (
    <main className="">
      <div className="flex flex-wrap gap-4">
        {mockImages.map((image) => (
          <div key={image.id} className="w-48">
            <img src={image.url} />
          </div>
        ))}
      </div>
      Hello, gallery in progress

    </main>
  );
}
