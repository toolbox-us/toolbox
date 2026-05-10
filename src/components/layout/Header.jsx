export default function Header({ navigation, search }) {
  return (
    <header className="panel panel-elevated mb-6">
      <div className="flex items-center gap-4">
        <div className="w-fit">
          {navigation}
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-ij-text sm:text-3xl">Toolbox</h1>
        </div>
        {search && <div className="ml-auto">{search}</div>}
      </div>
    </header>
  );
}
