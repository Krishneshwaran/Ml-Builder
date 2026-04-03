import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, FolderKanban, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectCard } from "@/components/project-card";
import { useState } from "react";
import type { Project } from "@shared/schema";

export default function Projects() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const filteredProjects = projects?.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" data-testid="projects-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="text-muted-foreground">
            Manage your ML projects and models
          </p>
        </div>
        <Button onClick={() => setLocation("/projects/new")} data-testid="button-new-project">
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-search-projects"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-4" />
                <Skeleton className="h-2 w-full mb-4" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : projects?.length === 0 ? (
        <div className="text-center py-16">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mx-auto mb-4">
            <FolderKanban className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">No projects yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Create your first machine learning project to start building production-ready models.
          </p>
          <Button onClick={() => setLocation("/projects/new")} data-testid="button-create-first-project">
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Project
          </Button>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No projects found matching "{searchQuery}"
          </p>
        </div>
      )}
    </div>
  );
}
