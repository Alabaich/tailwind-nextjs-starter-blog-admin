import DeployRail from '../../components/DeployRail';

export default function DashLayout({ children }) {
  return (
    <>
      <DeployRail />
      <div className="wrap">{children}</div>
    </>
  );
}
