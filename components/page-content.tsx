import styles from "./page-content.module.scss";

interface PageContentProps {
  children: React.ReactNode;
}
export default async function PageContent({ children }: PageContentProps) {
  return (
    <div className={styles.page}>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
