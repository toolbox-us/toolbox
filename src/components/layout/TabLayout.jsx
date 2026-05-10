import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';

export default function TabLayout({ tabs }) {
  return (
    <Tabs>
      <TabList>
        {tabs.map((tab) => (
          <Tab key={tab.key}>{tab.label}</Tab>
        ))}
      </TabList>
      {tabs.map((tab) => (
        <TabPanel key={tab.key}>
          <div className="panel">{tab.content}</div>
        </TabPanel>
      ))}
    </Tabs>
  );
}

