import Link from 'next/link';

const mediaData = [
  {
    link: 'https://vaultlayer.xyz',
    text: 'VaultLayer Website',
  },
  {
    link: 'https://x.com/VaultLayer',
    text: 'Twitter',
  },
  {
    link: 'https://t.me/+Q58TzLXmvGM0MGFh',
    text: 'Telegram',
  },
];

const Page = () => {
  return (
    <div className="text-primary container mx-auto flex h-full flex-col items-center justify-center gap-8 p-10 text-2xl font-bold">
      {mediaData.map((item) => {
        return (
          <Link key={item.link} href={item.link} target="_blank">
            {item.text}
          </Link>
        );
      })}
    </div>
  );
};

export default Page;
