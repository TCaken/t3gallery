// import { Modal } from "./modal";

export default async function ImageModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const imgId = (await params).id;
  return <div>{imgId}</div>;
}  