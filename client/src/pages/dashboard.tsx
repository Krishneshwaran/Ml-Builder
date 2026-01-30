import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, FolderKanban, Cpu, Activity, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsCard } from "@/components/stats-card";
import { ProjectCard } from "@/components/project-card";
import type { Project, Deployment } from "@shared/schema";

export default function Dashboard() {
  const [, setLocation] = useLocation();

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: deployments, isLoading: deploymentsLoading } = useQuery<Deployment[]>({
    queryKey: ["/api/deployments"],
  });

  const activeDeployments = deployments?.filter((d) => d.status === "active") || [];
  const totalRequests = deployments?.reduce((sum, d) => sum + (d.totalRequests || 0), 0) || 0;

  const recentProjects = projects?.slice(0, 4) || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" data-testid="dashboard-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your ML projects and deployments
          </p>
        </div>
        <Button onClick={() => setLocation("/projects/new")} data-testid="button-new-project">
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {projectsLoading || deploymentsLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <StatsCard
              title="Total Projects"
              value={projects?.length || 0}
              icon={FolderKanban}
              trend={{ value: 12, positive: true }}
            />
            <StatsCard
              title="Trained Models"
              value={projects?.filter((p) => p.status === "trained" || p.status === "deployed").length || 0}
              icon={Cpu}
            />
            <StatsCard
              title="Active Deployments"
              value={activeDeployments.length}
              icon={Cloud}
            />
            <StatsCard
              title="Total API Requests"
              value={totalRequests.toLocaleString()}
              icon={Activity}
              trend={{ value: 24, positive: true }}
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Recent Projects</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/projects")}
              data-testid="button-view-all-projects"
            >
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {projectsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full mb-4" />
                    <Skeleton className="h-2 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : recentProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted mx-auto mb-4">
                <FolderKanban className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No projects yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first ML project to get started
              </p>
              <Button onClick={() => setLocation("/projects/new")} data-testid="button-create-first-project">
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {activeDeployments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Active Deployments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeDeployments.map((deployment) => (
                <div
                  key={deployment.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/50"
                  data-testid={`deployment-item-${deployment.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-chart-2/20">
                      <Cloud className="w-4 h-4 text-chart-2" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{deployment.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {deployment.endpoint}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">
                      {deployment.requestsToday?.toLocaleString() || 0} today
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {deployment.avgLatency || 0}ms avg
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
