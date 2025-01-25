import Header from "./header";
import styles from "./page-content.module.scss";

interface PageContentProps {
  children: React.ReactNode;
}
export default async function PageContent({ children }: PageContentProps) {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <p>
          Created by{" "}
          <a href="https://off---piste.com" target="_blank">
            OFF-PISTE
          </a>
        </p>
      </footer>
    </div>
  );
}
