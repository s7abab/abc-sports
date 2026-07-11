import { redirect } from "next/navigation";

const BLOG_URL = "https://abcsports7.blogspot.com";

export default function Home() {
  redirect(BLOG_URL);
}
